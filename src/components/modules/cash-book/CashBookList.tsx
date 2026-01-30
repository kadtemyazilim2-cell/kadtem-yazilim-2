'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CashBookForm } from './CashBookForm';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/lib/store/use-auth';
import { useState, useMemo, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { toTurkishLower, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font';
import { Download, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMonth, getYear, startOfMonth, endOfMonth, isWithinInterval, parseISO, isValid } from 'date-fns';
import { deleteTransaction } from '@/actions/transaction';

export function CashBookList() {
    const { cashTransactions, sites, users, deleteCashTransaction } = useAppStore();
    const { user, hasPermission } = useAuth();
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all'); // [NEW]
    const [selectedType, setSelectedType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Date Filters
    const currentDate = new Date();
    // Default to current month start and end
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(endOfMonth(currentDate), 'yyyy-MM-dd'));

    // Helpers for quick month selection
    // We track the "quick select" state just for the UI of the dropdowns, 
    // but the source of truth is always startDate/endDate.
    const [quickMonth, setQuickMonth] = useState<string>(getMonth(currentDate).toString());
    const [quickYear, setQuickYear] = useState<string>(getYear(currentDate).toString());

    const months = [
        { value: '0', label: 'Ocak' },
        { value: '1', label: 'Şubat' },
        { value: '2', label: 'Mart' },
        { value: '3', label: 'Nisan' },
        { value: '4', label: 'Mayıs' },
        { value: '5', label: 'Haziran' },
        { value: '6', label: 'Temmuz' },
        { value: '7', label: 'Ağustos' },
        { value: '8', label: 'Eylül' },
        { value: '9', label: 'Ekim' },
        { value: '10', label: 'Kasım' },
        { value: '11', label: 'Aralık' },
    ];

    const years = Array.from({ length: 5 }, (_, i) => (getYear(currentDate) - 2 + i).toString());

    const handleQuickDateChange = (month: string, year: string) => {
        const start = startOfMonth(new Date(parseInt(year), parseInt(month), 1));
        const end = endOfMonth(start);
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
        setQuickMonth(month);
        setQuickYear(year);
    };

    // Helper for safe date formatting
    const safeFormat = (dateStr: string | Date | null | undefined, fmt: string) => {
        if (!dateStr) return '-';
        try {
            const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
            if (!isValid(d)) return '-';
            return format(d, fmt, { locale: tr });
        } catch (e) {
            return '-';
        }
    };

    const getSiteName = (id: string) => sites?.find((s: any) => s.id === id)?.name || '-';
    const getUserName = (id?: string) => users?.find((u: any) => u.id === id)?.name || '-';

    // Permission check for Reports & Date Filtering
    const canExport = hasPermission('cash-book', 'EXPORT');

    const filteredTransactions = useMemo(() => {
        let result = [...(cashTransactions || [])];

        // [NEW] Isolation Logic: If not ADMIN, only see own transactions
        if (user && user.role !== 'ADMIN') {
            // Strictly filter by responsibleUserId to ensure "My Cash" balance is correct.
            // We ignore createdByUserId because if I created a record for someone else, it shouldn't show in MY balance.
            result = result.filter(t => t.responsibleUserId === user.id);
        } else if (selectedUserId !== 'all') {
            // Admin filtering by user
            result = result.filter(t => (t.responsibleUserId || t.createdByUserId) === selectedUserId);
        }

        // [NEW] Site Filter
        if (selectedSiteId !== 'all') {
            result = result.filter(t => t.siteId === selectedSiteId);
        }

        // Date Filtering
        if (startDate && endDate) {
            const start = parseISO(startDate);
            // end of the selected end date (23:59:59)
            const end = new Date(parseISO(endDate));
            end.setHours(23, 59, 59, 999);

            result = result.filter(t => {
                const date = parseISO(t.date);
                return isWithinInterval(date, { start, end });
            });
        }

        if (selectedType !== 'ALL') {
            result = result.filter(t => t.type === selectedType);
        }

        if (searchTerm) {
            const search = toTurkishLower(searchTerm);
            result = result.filter(t => {
                const desc = toTurkishLower(t.description || '');
                const cat = toTurkishLower(t.category || '');
                const site = toTurkishLower(getSiteName(t.siteId));
                const person = toTurkishLower(getUserName(t.responsibleUserId || t.createdByUserId));

                return desc.includes(search) || cat.includes(search) || site.includes(search) || person.includes(search);
            });
        }

        // [NEW] Sort by Date Ascending (Oldest First) for chronological order
        result.sort((a: any, b: any) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;

            // If same date, sort by creation time (entry order)
            if (a.createdAt && b.createdAt) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }

            // Fallback to ID if no createdAt (legacy data)
            return (a.id || '').localeCompare(b.id || '');
        });

        return result;
    }, [cashTransactions, selectedUserId, selectedSiteId, searchTerm, startDate, endDate, user, sites, users]);

    // [NEW] Previous Balance Calculation
    const previousBalance = useMemo(() => {
        if (!startDate) return 0;

        const start = parseISO(startDate);

        // Filter transactions strictly BEFORE the start date calculate total balance until then
        // Apply SAME user/site filters as the main list
        let preTransactions = (cashTransactions || []).filter((t: any) => new Date(t.date) < start);

        if (user && user.role !== 'ADMIN') {
            preTransactions = preTransactions.filter((t: any) => t.responsibleUserId === user.id);
        } else if (selectedUserId !== 'all') {
            preTransactions = preTransactions.filter((t: any) => (t.responsibleUserId || t.createdByUserId) === selectedUserId);
        }

        // [NEW] Site Filter for Pre-Transactions
        if (selectedSiteId !== 'all') {
            preTransactions = preTransactions.filter((t: any) => t.siteId === selectedSiteId);
        }

        const income = preTransactions.filter((t: any) => t.type === 'INCOME').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        const expense = preTransactions.filter((t: any) => t.type === 'EXPENSE').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

        return income - expense;
    }, [cashTransactions, selectedUserId, selectedSiteId, startDate, user]);


    const filteredTransactionsWithBalance = useMemo(() => {
        let result = [...filteredTransactions];
        let runningBalance = previousBalance;

        // Since filteredTransactions is ALREADY sorted by Date Ascending, we can just map
        const calculated = result.map((t: any) => {
            const amt = t.amount || 0;
            if (t.type === 'INCOME') runningBalance += amt;
            else runningBalance -= amt;

            return { ...t, balance: runningBalance };
        });

        // [NEW] Add "Previous Balance" Row
        // This is added as the "first" item chronologically (so it will be last when reversed)
        const previousBalanceRow = {
            id: 'previous-balance-row',
            date: startDate, // Start of the period
            siteId: '', // General
            responsibleUserId: selectedUserId !== 'all' ? selectedUserId : '',
            type: 'BALANCE_START', // Custom type marker
            category: '-',
            description: 'DEVREDEN BAKİYE',
            amount: Math.abs(previousBalance),
            balance: previousBalance,
            createdAt: new Date(startDate).toISOString(), // Ensure it sorts correctly if needed
            createdByUserId: ''
        };

        // Prepend to chronological list (so it's the base)
        calculated.unshift(previousBalanceRow as any);

        // Reverse for display (Newest First) -> Previous Balance will be at the BOTTOM
        return calculated.reverse();
    }, [filteredTransactions, previousBalance, startDate, selectedUserId]);


    const getSiteBalances = () => {
        const balances: Record<string, { name: string; income: number; expense: number; previousBalance: number }> = {};

        // Initialize with active sites
        sites?.forEach((s: any) => {
            balances[s.id] = { name: s.name, income: 0, expense: 0, previousBalance: 0 };
        });

        // 1. Calculate Previous Balance per Site
        if (startDate) {
            const start = parseISO(startDate);

            let preList = cashTransactions.filter((t: any) => new Date(t.date) < start);

            // Apply same User Filter
            if (user && user.role !== 'ADMIN') {
                preList = preList.filter((t: any) => t.responsibleUserId === user.id);
            } else if (selectedUserId !== 'all') {
                preList = preList.filter((t: any) => (t.responsibleUserId || t.createdByUserId) === selectedUserId);
            }

            preList.forEach((t: any) => {
                if (!balances[t.siteId]) return; // Skip if site deleted or unknown
                if (t.type === 'INCOME') balances[t.siteId].previousBalance += t.amount;
                else balances[t.siteId].previousBalance -= t.amount;
            });
        }

        // 2. Add Current Period Transactions
        // filteredTransactions is already filtered by User and Date
        filteredTransactions.forEach((t: any) => {
            if (!balances[t.siteId]) return;
            if (t.type === 'INCOME') balances[t.siteId].income += t.amount;
            else balances[t.siteId].expense += t.amount;
        });

        return Object.values(balances).filter(b => b.income > 0 || b.expense > 0 || b.previousBalance !== 0);
    };


    const exportExcel = () => {
        // Main Data
        const data: any[] = filteredTransactionsWithBalance.map((t: any) => ({
            'Tarih': format(new Date(t.date), 'dd.MM.yyyy', { locale: tr }),
            'Personel': t.type === 'BALANCE_START' ? '-' : getUserName(t.responsibleUserId || t.createdByUserId),
            'Kategori': t.category,
            'Açıklama': t.description,
            'Borç': t.type === 'INCOME' ? t.amount : (t.type === 'BALANCE_START' ? t.amount : 0),
            'Alacak': t.type === 'EXPENSE' ? t.amount : 0,
            'Tutar': t.type === 'BALANCE_START' ? t.amount : (t.type === 'INCOME' ? t.amount : -t.amount), // [NEW] Signed Amount
            'Kümülatif Toplam': t.balance
        }));

        // Site Summaries
        const siteBalances = getSiteBalances();
        if (siteBalances.length > 0) {
            data.push({}); // Spacer
            data.push({ 'Tarih': 'ŞANTİYE PROJE ÖZETİ' }); // Header
            data.push({
                'Tarih': 'Şantiye Adı',
                'Personel': 'Devreden',
                'Kategori': 'Dönem Gelir',
                'Açıklama': 'Dönem Gider',
                'Borç': 'SON BAKİYE',
                'Alacak': '', // Spacer
                'Tutar': ''   // Spacer
            });

            let totalPrev = 0;
            let totalInc = 0;
            let totalExp = 0;
            let totalBal = 0;
            // Tutar total is effectively totalBal - totalPrev (Net Change), but let's calc explicitly if needed.
            // Actually Tutar sum = (Income - Expense).
            let totalNet = 0; // Net Change (Gelir - Gider)

            siteBalances.forEach(sb => {
                const total = sb.previousBalance + sb.income - sb.expense;
                const netChange = sb.income - sb.expense;

                totalPrev += sb.previousBalance;
                totalInc += sb.income;
                totalExp += sb.expense;
                totalBal += total;
                totalNet += netChange;

                data.push({
                    'Tarih': sb.name,
                    'Personel': sb.previousBalance,
                    'Kategori': sb.income,
                    'Açıklama': sb.expense,
                    'Borç': total,
                    'Alacak': '',
                    'Tutar': ''
                });
            });

            // [NEW] General Total
            data.push({});
            data.push({
                'Tarih': 'GENEL TOPLAM',
                'Personel': totalPrev,
                'Kategori': totalInc,
                'Açıklama': totalExp,
                'Borç': totalBal,
                'Alacak': '',
                'Tutar': totalNet
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Kasa Hareketleri");
        XLSX.writeFile(wb, `Kasa_Hareketleri_${startDate}_${endDate}.xlsx`);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const dateStr = `${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`;
        doc.setFontSize(14);
        doc.text(`Kasa Hareketleri Raporu - ${dateStr}`, 14, 15);

        if (selectedUserId !== 'all') {
            doc.setFontSize(11);
            doc.text(`Personel: ${getUserName(selectedUserId)}`, 14, 22);
            doc.text(`Devreden Bakiye: ${previousBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`, 14, 28);
        }

        const groupedData: Record<string, typeof filteredTransactionsWithBalance> = {};

        if (selectedUserId === 'all') {
            // [CHANGED] Do not separate by user, keep as single list to match screen
            groupedData['all'] = [...filteredTransactionsWithBalance];
        } else {
            groupedData[selectedUserId] = [...filteredTransactionsWithBalance];
        }

        let yPos = selectedUserId !== 'all' ? 35 : 30;

        // 1. Transaction Tables
        Object.keys(groupedData).forEach((key) => {
            const transactions = groupedData[key];

            // [CHANGED] Use EXACT list from screen (Newest First), do not re-sort
            // Balances are ALREADY calculated in 'transactions' (which are filteredTransactionsWithBalance)

            const userName = key === 'all' ? 'Tüm Personel' : getUserName(key);
            const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
            const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);

            if (yPos > 270) { doc.addPage(); yPos = 20; }
            doc.text(`${userName} (Devreden: ${previousBalance.toLocaleString('tr-TR', { currency: 'TRY', style: 'currency' })})`, 14, yPos);
            yPos += 5;

            const tableData = transactions.map(t => {
                let typeLabel = 'Gider';
                if (t.type === 'INCOME') typeLabel = 'Gelir';
                else if (t.type === 'BALANCE_START') typeLabel = 'Devir';

                return [
                    format(new Date(t.date), 'dd.MM.yyyy'),
                    t.category,
                    t.description,
                    // Borç (Gelir)
                    t.type === 'INCOME' || t.type === 'BALANCE_START' ? `${t.amount.toLocaleString('tr-TR')} TL` : '-',
                    // Alacak (Gider)
                    t.type === 'EXPENSE' ? `${t.amount.toLocaleString('tr-TR')} TL` : '-',
                    // Tutar (Signed) [NEW]
                    `${(t.type === 'BALANCE_START' ? t.amount : (t.type === 'INCOME' ? t.amount : -t.amount)).toLocaleString('tr-TR')} TL`,
                    `${t.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
                ]
            });

            autoTable(doc, {
                startY: yPos + 4,
                head: [['Tarih', 'Personel', 'Kategori', 'Açıklama', 'Borç', 'Alacak', 'Tutar', 'Bakiye']], // Added Tutar
                body: tableData,
                styles: { font: 'Roboto', fontSize: 8 }, // Slightly smaller font to fit
                headStyles: { fillColor: [71, 85, 105] }, // Match Blue-Gray
                theme: 'grid',
                didParseCell: (data) => {
                    const rowIndex = data.row.index;
                    const section = data.section;
                    if (section === 'body') {
                        const transaction = transactions[rowIndex];
                        if (transaction) {
                            // Amount coloring
                            if (data.column.index === 4 && (transaction.type === 'INCOME' || transaction.type === 'BALANCE_START')) {
                                data.cell.styles.textColor = [22, 163, 74];
                            } else if (data.column.index === 5 && transaction.type === 'EXPENSE') {
                                data.cell.styles.textColor = [220, 38, 38];
                            } else if (data.column.index === 6) { // Tutar Column
                                if (transaction.type === 'INCOME' || transaction.type === 'BALANCE_START') data.cell.styles.textColor = [22, 163, 74];
                                else data.cell.styles.textColor = [220, 38, 38];
                            }

                            // Style Devir row
                            if (transaction.type === 'BALANCE_START') {
                                data.cell.styles.fontStyle = 'bold';
                                if (data.column.index === 4) data.cell.styles.textColor = [59, 130, 246]; // Blue for Devir
                                if (data.column.index === 6) data.cell.styles.textColor = [59, 130, 246]; // Blue for Devir Tutar
                            }
                        }
                    }
                }
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 5;

            if (yPos > 270) { doc.addPage(); yPos = 20; }

            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Dönem Gelir: ${totalIncome.toLocaleString('tr-TR')} TL`, 14, yPos);
            doc.text(`Dönem Gider: ${totalExpense.toLocaleString('tr-TR')} TL`, 70, yPos);

            // [FIXED] Calculate final balance from the newest transaction (top of list) or previous balance
            const finalBalance = transactions.length > 0 ? transactions[0].balance : previousBalance;
            const totalBalanceText = `Son Bakiye: ${finalBalance.toLocaleString('tr-TR')} TL`;

            if (finalBalance >= 0) doc.setTextColor(0, 128, 0);
            else doc.setTextColor(200, 0, 0);

            doc.text(totalBalanceText, 130, yPos);

            yPos += 15;

            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        });


        // 2. Site Summary Section
        const siteBalances = getSiteBalances();
        // Only show if there's more than one active site in the report to avoid redundancy, 
        // OR as user requested "birden fazla şantiyede" - but safest to show if any data exists.
        if (siteBalances.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            else yPos += 10;

            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text("Şantiye Bazlı Bakiye Özeti", 14, yPos);

            let totalPrev = 0;
            let totalInc = 0;
            let totalExp = 0;
            let totalBal = 0;

            const summaryData = siteBalances.map(sb => {
                const total = sb.previousBalance + sb.income - sb.expense;
                totalPrev += sb.previousBalance;
                totalInc += sb.income;
                totalExp += sb.expense;
                totalBal += total;

                return [
                    sb.name,
                    sb.previousBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    sb.income.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    sb.expense.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    total.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL'
                ];
            });

            // [NEW] General Total Row
            summaryData.push([
                'GENEL TOPLAM',
                totalPrev.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                totalInc.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                totalExp.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                totalBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL'
            ]);

            autoTable(doc, {
                startY: yPos + 5,
                head: [['Şantiye', 'Devreden', 'Dönem Gelir', 'Dönem Gider', 'Son Bakiye']],
                body: summaryData,
                styles: { font: 'Roboto', fontSize: 10 },
                headStyles: { fillColor: [30, 41, 59] }, // Darker header for summary
                theme: 'striped',
                didParseCell: (data) => {
                    // Make last row bold (General Total)
                    if (data.section === 'body' && data.row.index === summaryData.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [200, 200, 200];
                    }
                }
            });
        }

        doc.save(`Kasa_Raporu_${dateStr}.pdf`);
    };

    const handleDelete = async (id: string) => {
        // [NEW] Find transaction to check date
        const transaction = cashTransactions.find((t: any) => t.id === id);
        if (!transaction) return;

        // [NEW] Date Restriction Check
        if (user && user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(transaction.date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Bu kayıt ${user.editLookbackDays} günden daha eski olduğu için silinemez.`);
                return;
            }
        }

        if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
            try {
                const res = await deleteTransaction(id);
                if (res.success) {
                    deleteCashTransaction(id);
                } else {
                    alert(res.error || 'Silme işlemi başarısız.');
                }
            } catch (error) {
                console.error(error);
                alert('Bir hata oluştu.');
            }
        }
    };

    const [mounted, setMounted] = useState(false);

    // Fix hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // ... existing helpers ...

    if (!mounted) return null; // Prevent hydration error

    return (
        <Card>
            <CardHeader className="space-y-4 p-6">
                {/* Top Row: Title & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-2xl font-bold">Kasa Hareketleri</CardTitle>
                    <div className="flex gap-2">
                        {canExport && (
                            <>
                                <Button variant="outline" onClick={exportPDF} title="PDF İndir">
                                    <FileText className="h-4 w-4 text-red-600 mr-2" />
                                    PDF
                                </Button>
                                <Button variant="outline" onClick={exportExcel} title="Excel İndir">
                                    <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                                    Excel
                                </Button>
                            </>
                        )}
                        <CashBookForm />
                    </div>
                </div>

                {/* Filter Row: Grid Layout */}
                <div className="bg-slate-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Search - Col 3 */}
                        <div className={cn("col-span-12 relative", canExport ? "md:col-span-3" : "md:col-span-10")}>
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ara..."
                                className="pl-8 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Site Filter - Col 2 */}
                        <div className="col-span-12 md:col-span-2">
                            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="Şantiye Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Şantiyeler</SelectItem>
                                    {sites?.filter((s: any) => s.status === 'ACTIVE' && !s.finalAcceptanceDate).map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* User Filter (Admin Only) - Col 2 */}
                        {user?.role === 'ADMIN' && (
                            <div className="col-span-12 md:col-span-2">
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Personel Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Personel</SelectItem>
                                        {users?.map((u: any) => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Date Range - Col 3 */}
                        {canExport && (
                            <div className={cn("col-span-12 flex gap-2 items-center", user?.role === 'ADMIN' ? "md:col-span-3" : "md:col-span-5")}>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-white"
                                />
                                <span className="text-muted-foreground font-bold">-</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        )}

                        {/* Month/Year Shortcuts - Col 2 */}
                        {canExport && (
                            <div className="col-span-12 md:col-span-2 flex gap-2">
                                <Select value={quickMonth} onValueChange={(m) => handleQuickDateChange(m, quickYear)}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Ay" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={quickYear} onValueChange={(y) => handleQuickDateChange(quickMonth, y)}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Yıl" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4 p-2 bg-slate-50 border rounded text-xs text-muted-foreground">
                    <span className="font-semibold">Devreden Bakiye: </span>
                    {previousBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Personel</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Açıklama</TableHead>
                            <TableHead className="text-right text-green-700">Borç (Gelir)</TableHead>
                            <TableHead className="text-right text-red-700">Alacak (Gider)</TableHead>
                            <TableHead className="text-right text-slate-700">Tutar (+/-)</TableHead>
                            <TableHead>Bakiye</TableHead>
                            <TableHead className="w-10"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactionsWithBalance?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                                    {selectedUserId === 'all' ? 'Henüz kayıtlı işlem yok.' : 'Seçili personel için işlem bulunamadı.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactionsWithBalance.map((item) => (
                                <TableRow key={item.id} className={item.type === 'BALANCE_START' ? "bg-blue-50/50 hover:bg-blue-50 border-t-2 border-slate-200" : ""}>
                                    <TableCell>{safeFormat(item.date, 'dd MMM yyyy')}</TableCell>
                                    <TableCell>{item.type === 'BALANCE_START' ? '-' : getUserName(item.responsibleUserId || item.createdByUserId)}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell className="max-w-[200px] truncate font-medium" title={item.description}>{item.description}</TableCell>

                                    {/* Borç (Income) */}
                                    <TableCell className="text-right font-mono text-green-600 font-bold">
                                        {(item.type === 'INCOME' || item.type === 'BALANCE_START') ? `${Number(item.amount || 0).toLocaleString('tr-TR')} TL` : '-'}
                                    </TableCell>

                                    {/* Alacak (Expense) */}
                                    <TableCell className="text-right font-mono text-red-600 font-bold">
                                        {item.type === 'EXPENSE' ? `${Number(item.amount || 0).toLocaleString('tr-TR')} TL` : '-'}
                                    </TableCell>

                                    {/* Tutar (Signed) */}
                                    <TableCell className="text-right font-mono font-bold text-slate-900">
                                        {item.type === 'BALANCE_START' ? (item.amount > 0 ? '' : '-') : (item.type === 'EXPENSE' ? '-' : '')}
                                        {Number(item.amount || 0).toLocaleString('tr-TR')} TL
                                    </TableCell>

                                    <TableCell className="font-mono font-medium">
                                        {Number(item.balance || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                    </TableCell>
                                    <TableCell>
                                        {item.type !== 'BALANCE_START' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card >
    );
}
