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
import { fontBase64, addTurkishFont } from '@/lib/pdf-font';
import { Download, FileSpreadsheet, FileText, Trash2, Edit, CreditCard, Banknote, BarChart } from 'lucide-react'; // [NEW] Edit, Icons
import { Button } from '@/components/ui/button';
import { isWithinInterval, parseISO, isValid, startOfMonth } from 'date-fns';
import { deleteTransaction, getTransaction } from '@/actions/transaction';

interface CashBookListProps {
    siteId?: string;
    userId?: string; // [NEW]
    type?: 'INCOME' | 'EXPENSE' | 'ALL';
    initialData?: any[]; // [NEW] Server fetched data
    currentUser?: any; // [NEW] Sync server user to client store
}

export function CashBookList({ siteId, userId, type, initialData, currentUser }: CashBookListProps) {
    const { cashTransactions, sites, users, deleteCashTransaction } = useAppStore();

    // [NEW] Sync Server Data to Store
    useEffect(() => {
        if (initialData) {
            useAppStore.setState({ cashTransactions: initialData });
        }
        // [FIX] Sync Server User Session to Client Store to ensure permissions are up-to-date
        if (currentUser) {
            console.log("Syncing Server User to Client Store:", currentUser.username);
            useAuth.setState({ user: currentUser, isAuthenticated: true });
        }
    }, [initialData, currentUser]);

    const { user, hasPermission } = useAuth();

    // [FIX] Define granular permissions
    const canCreate = hasPermission('cash-book', 'CREATE');
    const canEdit = hasPermission('cash-book', 'EDIT');
    const canDelete = hasPermission('cash-book', 'DELETE');

    // [FIX] Consolidate "Admin View" logic
    // Admin or User with explicit 'cash-book.admin-view' permission
    const canViewAll = useMemo(() => {
        return user?.role === 'ADMIN' || hasPermission('cash-book.admin-view', 'VIEW');
    }, [user, hasPermission]);

    // [FIX] Initialize selectedUserId to 'all' ONLY if allowed, otherwise force own ID
    // If userId prop is passed, use it, else if canViewAll use 'all', else use user.id
    const [selectedUserId, setSelectedUserId] = useState<string>(
        userId || (canViewAll ? 'all' : (user?.id || 'all'))
    );

    const [selectedSiteId, setSelectedSiteId] = useState<string>(siteId || 'all');
    const [selectedType, setSelectedType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>(type || 'ALL');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'ALL' | 'CASH' | 'CREDIT_CARD'>('CASH'); // [MOD] Default to CASH
    const [searchTerm, setSearchTerm] = useState('');

    // Update state if props change or Perms change
    useEffect(() => {
        if (siteId) setSelectedSiteId(siteId);
        if (type) setSelectedType(type);
        if (userId) setSelectedUserId(userId);

        // [FIX] If user gained permission dynamically, ensure they can see all if not restricted by prop
        if (!userId && canViewAll && selectedUserId !== 'all' && selectedUserId === user?.id) {
            // Optional: Don't force reset if they manually selected, but for initial load it helps
        }
    }, [siteId, type, userId, canViewAll]);

    // [NEW] Edit State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<any>(null);
    const [formDefaultValues, setFormDefaultValues] = useState<any>(undefined); // [NEW] Default values for form
    const [showReport, setShowReport] = useState(false); // [NEW] Toggle report view for restricted users

    // Date Filters - Default to last 1 month
    const currentDate = new Date();
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(currentDate, 'yyyy-MM-dd'));

    // [FIX] Auto-switch to 'all' if Admin View is detected later (after mount)
    useEffect(() => {
        // If user has Admin View, and current selection is self (default), switch to 'all'
        // Check if selectedUserId matches user.id OR if it's implicitly set to user.id via initial state
        if (canViewAll && user?.id && (selectedUserId === user.id)) {
            setSelectedUserId('all');
        }
    }, [canViewAll, user?.id, selectedUserId]);

    // Helper for safe date formatting
    const safeFormat = (dateStr: string | Date | number | null | undefined, fmt: string) => {
        if (!dateStr) return '-';
        try {
            let d: Date;
            if (typeof dateStr === 'string') {
                d = parseISO(dateStr);
                // Fallback for non-ISO strings if parseISO fails or returns invalid
                if (!isValid(d)) d = new Date(dateStr);
            } else if (typeof dateStr === 'number') {
                d = new Date(dateStr);
            } else {
                d = dateStr as Date;
            }

            if (!isValid(d)) return '-';
            return format(d, fmt);
        } catch (e) {
            return '-';
        }
    };

    const getSiteName = (id: string) => sites?.find((s: any) => s.id === id)?.name || '-';
    const getUserName = (id?: string) => users?.find((u: any) => u.id === id)?.name || '-';

    // Permission check for Reports & Date Filtering
    // [FIX] Allow export if user has explicit EXPORT permission OR has Admin View / Reports View
    // This allows users with "Yönetici Görünümü" to also download the data they see.
    const canExport = hasPermission('cash-book', 'EXPORT') || canViewAll || hasPermission('cash-book.reports', 'VIEW');

    const filteredTransactions = useMemo(() => {
        let result = [...(cashTransactions || [])];

        console.log(`[CashBookList] canViewAll: ${canViewAll}, selectedUserId: ${selectedUserId}`);
        console.log(`[CashBookList] Total Transactions: ${result.length}`);
        console.log(`[CashBookList] Filters - Site: ${selectedSiteId}, Date: ${startDate}-${endDate}`);

        // Ensure valid objects
        result = result.filter(t => t && typeof t === 'object');

        // [REMOVED] Client-side isolation logic. 
        // Server already filters data based on permissions in getAllTransactions.
        // Doing it here again causes issues if user role is delayed or mismatched.

        if (!canViewAll && user) {
            // Force filter to own ID if not Admin/ViewAll
            result = result.filter(t => (t.responsibleUserId || t.createdByUserId) === user.id);
        } else if (canViewAll && selectedUserId === 'all') {
            // [MOD] Admin must select a personnel to see transactions
            return [];
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

            if (isValid(start) && isValid(end)) {
                result = result.filter(t => {
                    if (!t.date) return false;
                    const date = new Date(t.date); // Safe for Date obj or ISO string
                    if (!isValid(date)) return false;
                    return isWithinInterval(date, { start, end });
                });
            }
        }

        if (selectedType !== 'ALL') {
            result = result.filter(t => t.type === selectedType);
        }

        // [NEW] Payment Method Filter
        if (selectedPaymentMethod !== 'ALL') {
            if (selectedPaymentMethod === 'CASH') {
                // Include CASH and NULL (legacy)
                result = result.filter(t => t.paymentMethod === 'CASH' || !t.paymentMethod);
            } else {
                result = result.filter(t => t.paymentMethod === selectedPaymentMethod);
            }
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
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            // Handle invalid dates in sort
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;

            const dateDiff = dateA - dateB;
            if (dateDiff !== 0) return dateDiff;

            // If same date, sort by creation time (entry order)
            if (a.createdAt && b.createdAt) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }

            // Fallback to ID if no createdAt (legacy data)
            return (a.id || '').localeCompare(b.id || '');
        });

        return result;
    }, [cashTransactions, selectedUserId, selectedSiteId, searchTerm, startDate, endDate, user, sites, users, selectedPaymentMethod, selectedType]);

    // [NEW] Previous Balance Calculation
    const previousBalance = useMemo(() => {
        if (!startDate) return 0;

        const start = parseISO(startDate);
        if (!isValid(start)) return 0;

        // Filter transactions strictly BEFORE the start date calculate total balance until then
        // Apply SAME user/site filters as the main list
        let preTransactions = (cashTransactions || []).filter((t: any) => {
            if (!t || typeof t !== 'object' || !t.date) return false;
            const d = new Date(t.date);
            if (isNaN(d.getTime())) return false;
            return d < start;
        });

        if (selectedUserId !== 'all') {
            preTransactions = preTransactions.filter((t: any) => (t.responsibleUserId || t.createdByUserId) === selectedUserId);
        }

        // [NEW] Site Filter for Pre-Transactions
        if (selectedSiteId !== 'all') {
            preTransactions = preTransactions.filter((t: any) => t.siteId === selectedSiteId);
        }

        // [NEW] Payment Method Filter for Previous Balance
        if (selectedPaymentMethod !== 'ALL') {
            if (selectedPaymentMethod === 'CASH') {
                preTransactions = preTransactions.filter((t: any) => t.paymentMethod === 'CASH' || !t.paymentMethod);
            } else {
                preTransactions = preTransactions.filter((t: any) => t.paymentMethod === selectedPaymentMethod);
            }
        }

        // [MOD] Ensure CREDIT_CARD is excluded from Balance Calculation if no specific filter is set or even if set?
        // User Requirement: "sadece nakit olan kümülatif toplamı göster"
        // This usually implies the "Balance" column should reflect Cash-Flow only.
        preTransactions = preTransactions.filter((t: any) => t.paymentMethod !== 'CREDIT_CARD');

        const income = preTransactions.filter((t: any) => t.type === 'INCOME').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const expense = preTransactions.filter((t: any) => t.type === 'EXPENSE').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

        return income - expense;
    }, [cashTransactions, selectedUserId, selectedSiteId, startDate, user, selectedPaymentMethod]);


    const filteredTransactionsWithBalance = useMemo(() => {
        let result = [...filteredTransactions];
        let runningBalance = previousBalance;

        // Since filteredTransactions is ALREADY sorted by Date Ascending, we can just map
        const calculated = result.map((t: any) => {
            if (!t) return t;

            // [MOD] If Credit Card, do NOT update balance, but keep valid balance for display? 
            // Or just keep previous balance?
            // If we don't update runningBalance, the balance remains same as previous row.

            if (t.paymentMethod === 'CREDIT_CARD') {
                return { ...t, balance: runningBalance };
            }

            const amt = Number(t.amount || 0);
            if (t.type === 'INCOME') runningBalance += amt;
            else runningBalance -= amt;

            return { ...t, balance: runningBalance };
        });

        // [NEW] Add "Previous Balance Row"
        // This is added as the "first" item chronologically (so it's base)

        let validStartDateIso = new Date().toISOString();
        try {
            if (startDate) {
                const d = new Date(startDate);
                if (!isNaN(d.getTime())) validStartDateIso = d.toISOString();
            }
        } catch (e) {
            console.error("Invalid start date for row creation", e);
        }

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
            createdAt: validStartDateIso, // Ensure it sorts correctly if needed
            createdByUserId: ''
        };

        // Prepend to chronological list
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

        // [FIX] Use cashTransactions filtered ONLY by user (not by site)
        // so that all sites where the user spent money are shown
        let userTransactions = [...(cashTransactions || [])].filter(t => t && typeof t === 'object');

        if (!canViewAll && user) {
            userTransactions = userTransactions.filter((t: any) => (t.responsibleUserId || t.createdByUserId) === user.id);
        } else if (selectedUserId !== 'all') {
            userTransactions = userTransactions.filter((t: any) => (t.responsibleUserId || t.createdByUserId) === selectedUserId);
        }

        // 1. Calculate Previous Balance per Site
        if (startDate) {
            const start = parseISO(startDate);
            const preList = userTransactions.filter((t: any) => t.date && new Date(t.date) < start);

            preList.forEach((t: any) => {
                if (!t || !t.siteId || !balances[t.siteId]) return;
                const amt = Number(t.amount || 0);
                if (t.type === 'INCOME') balances[t.siteId].previousBalance += amt;
                else balances[t.siteId].previousBalance -= amt;
            });
        }

        // 2. Add Current Period Transactions (date-filtered but NOT site-filtered)
        let currentPeriod = userTransactions;
        if (startDate && endDate) {
            const start = parseISO(startDate);
            const end = new Date(parseISO(endDate));
            end.setHours(23, 59, 59, 999);
            if (isValid(start) && isValid(end)) {
                currentPeriod = currentPeriod.filter((t: any) => {
                    if (!t.date) return false;
                    const d = new Date(t.date);
                    return isValid(d) && isWithinInterval(d, { start, end });
                });
            }
        }

        currentPeriod.forEach((t: any) => {
            if (!t || !t.siteId || !balances[t.siteId]) return;
            const amt = Number(t.amount || 0);
            if (t.type === 'INCOME') balances[t.siteId].income += amt;
            else balances[t.siteId].expense += amt;
        });

        return Object.values(balances).filter(b => b.income > 0 || b.expense > 0 || b.previousBalance !== 0);
    };


    const exportExcel = () => {
        // Main Data
        const data: any[] = filteredTransactionsWithBalance.map((t: any) => ({
            'Tarih': safeFormat(t.date, 'dd.MM.yyyy'),
            'Personel': t.type === 'BALANCE_START' ? '-' : getUserName(t.responsibleUserId || t.createdByUserId),
            'Kategori': t.category,
            'Açıklama': t.description,
            'Borç': t.type === 'INCOME' ? t.amount : (t.type === 'BALANCE_START' ? t.amount : 0),
            'Alacak': t.type === 'EXPENSE' ? t.amount : 0,
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
                'Alacak': '' // Spacer
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
                    'Alacak': ''
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
                'Alacak': ''
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Kasa Hareketleri");
        XLSX.writeFile(wb, `Kasa_Hareketleri_${startDate}_${endDate}.xlsx`);
    };

    const exportPDF = () => {
        try {
            const doc = new jsPDF();
            addTurkishFont(doc);
            doc.setFont('Roboto');

            // [NEW] 1. Report Generation Date (Top Right, Gray)
            const reportGenDate = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150); // Gray
            doc.text(`Oluşturulma Tarihi: ${reportGenDate}`, 200, 10, { align: 'right' });

            // [NEW] 2. Left Aligned Header Hierarchy
            // Date Range
            const dateStr = `${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`;

            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            // Title with Date - Centered
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.text(`KASA HAREKETLERİ RAPORU (${dateStr})`, pageWidth / 2, 20, { align: 'center' });

            let currentY = 26; // [MOD] Reduced gap (was 28)

            // Personnel Name
            if (selectedUserId !== 'all') {
                doc.setFontSize(10); // [MOD] Reduced from 12
                doc.text(`Personel: ${getUserName(selectedUserId)}`, 14, currentY, { align: 'left' });
                currentY += 5; // [MOD] Reduced gap (was 7)
            }

            // Site Name
            if (selectedSiteId !== 'all') {
                doc.setFontSize(10);
                doc.text(`Şantiye: ${getSiteName(selectedSiteId)}`, 14, currentY, { align: 'left' });
                currentY += 5;
            }

            // Payment Method
            if (selectedPaymentMethod !== 'ALL') {
                doc.setFontSize(10);
                const methodLabel = selectedPaymentMethod === 'CASH' ? 'Nakit' : 'Kredi Kartı';
                doc.text(`Harcama Türü: ${methodLabel}`, 14, currentY, { align: 'left' });
                currentY += 5;
            }

            const groupedData: Record<string, typeof filteredTransactionsWithBalance> = {};

            if (selectedUserId === 'all') {
                groupedData['all'] = [...filteredTransactionsWithBalance];
            } else {
                groupedData[selectedUserId] = [...filteredTransactionsWithBalance];
            }

            let yPos = currentY;

            // Transaction Tables
            Object.keys(groupedData).forEach((key) => {
                const transactions = groupedData[key];
                const userName = key === 'all' ? 'Tüm Personel' : getUserName(key);
                const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
                const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);

                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);

                // Only show subheading if we are listing ALL users, otherwise header covers it
                if (selectedUserId === 'all') {
                    if (yPos > 270) { doc.addPage(); yPos = 20; }
                    doc.text(`${userName}`, 14, yPos);
                    yPos += 5;
                }
                // Removed "Devreden Bakiye" text by user request

                const tableData = transactions.map(t => {
                    return [
                        safeFormat(t.date, 'dd.MM.yyyy'),
                        t.category,
                        t.description,
                        t.type === 'INCOME' || t.type === 'BALANCE_START' ? `${t.amount.toLocaleString('tr-TR')} TL` : '-',
                        t.type === 'EXPENSE' ? `${t.amount.toLocaleString('tr-TR')} TL` : '-',
                        `${t.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
                    ]
                });

                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Tarih', 'Kategori', 'Açıklama', 'Borç', 'Alacak', 'Bakiye']],
                    body: tableData,
                    styles: { font: 'Roboto', fontSize: 8, textColor: 0 },
                    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 22 }, // Tarih
                        1: { cellWidth: 25 }, // Kategori
                        2: { cellWidth: 'auto' }, // Açıklama
                        3: { cellWidth: 25, halign: 'right' }, // Borç
                        4: { cellWidth: 28, halign: 'right' }, // Alacak
                        5: { cellWidth: 32, halign: 'right' }  // Bakiye
                    },
                    theme: 'grid',
                    didParseCell: (data) => {
                        const rowIndex = data.row.index;
                        const section = data.section;
                        if (section === 'body') {
                            const transaction = transactions[rowIndex];
                            if (transaction) {
                                if (data.column.index === 3 && (transaction.type === 'INCOME' || transaction.type === 'BALANCE_START')) {
                                    data.cell.styles.textColor = [22, 163, 74];
                                } else if (data.column.index === 4 && transaction.type === 'EXPENSE') {
                                    data.cell.styles.textColor = [220, 38, 38];
                                }
                                if (transaction.type === 'BALANCE_START') {
                                    data.cell.styles.fontStyle = 'bold';
                                    if (data.column.index === 3) data.cell.styles.textColor = [59, 130, 246];
                                }
                            }
                        }
                    }
                });

                // @ts-ignore
                yPos = doc.lastAutoTable.finalY + 10;
            });

            // [NEW] 3. Site Summary Section (Moved before Signatures)
            const siteBalances = getSiteBalances();
            if (siteBalances.length > 0) {
                // Check urgency for page break
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(11); // [MOD] Reduced from 14
                doc.setTextColor(0, 0, 0);
                doc.text("Şantiyeler Bakiye Özeti", 14, yPos);
                yPos += 5; // Space for title

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

                summaryData.push([
                    'GENEL TOPLAM',
                    totalPrev.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    totalInc.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    totalExp.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL',
                    totalBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL'
                ]);

                autoTable(doc, {
                    startY: yPos,
                    head: [['Şantiye', 'Devreden', 'Dönem Gelir', 'Dönem Gider', 'Son Bakiye']],
                    body: summaryData,
                    styles: { font: 'Roboto', fontSize: 7, textColor: 50, cellPadding: 1 },
                    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
                    theme: 'grid',
                    columnStyles: {
                        0: { cellWidth: 'auto' },
                        1: { cellWidth: 35, halign: 'right' },
                        2: { cellWidth: 35, halign: 'right' },
                        3: { cellWidth: 35, halign: 'right' },
                        4: { cellWidth: 40, halign: 'right' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.row.index === summaryData.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [200, 200, 200];
                        }
                    }
                });

                // Update yPos after summary table
                // @ts-ignore
                yPos = doc.lastAutoTable.finalY + 20;
            } else {
                yPos += 20; // Margin if no summary
            }

            // [FIX] 4. Signature Boxes - Right after table, not at page bottom
            // Check if enough space for signatures (need ~45mm)
            const pageHeight = doc.internal.pageSize.height || 297;
            if (yPos + 45 > pageHeight - 10) {
                doc.addPage();
                yPos = 20;
            }

            let signatureY = yPos + 10;

            const boxWidth = 70;
            const boxHeight = 25;
            const leftX = 20;
            const rightX = 120;

            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);

            // Left Box - Harcama Yapan
            doc.text("Harcama Yapan", leftX + (boxWidth / 2), signatureY - 5, { align: 'center' });
            doc.rect(leftX, signatureY, boxWidth, boxHeight);

            // Right Box - Harcama Yetkilisi
            doc.text("Harcama Yetkilisi", rightX + (boxWidth / 2), signatureY - 5, { align: 'center' });
            doc.rect(rightX, signatureY, boxWidth, boxHeight);

            doc.save(`Kasa_Raporu_${dateStr}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
        }
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

        // [SECURE] Explicit Permission Check
        if (!canDelete) {
            alert('Bu işlemi silme yetkiniz yok.');
            return;
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
                        {/* [MOD] Export Buttons - Visible to ALL with permission */}
                        {canExport && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={exportPDF} title="PDF İndir">
                                    <FileText className="h-4 w-4 text-red-600 mr-2" />
                                    PDF
                                </Button>
                                <Button variant="outline" onClick={exportExcel} title="Excel İndir">
                                    <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                                    Excel
                                </Button>
                            </div>
                        )}

                        {/* [MOD] Role-Based Action Buttons */}
                        {(canViewAll) ? (
                            <>
                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                                    setEditingTransaction(null);
                                    setFormDefaultValues(undefined); // Reset defaults
                                    setIsFormOpen(true);
                                }}>
                                    + İşlem Ekle
                                </Button>
                            </>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                                <Button
                                    variant="outline"
                                    className="h-auto min-h-[3rem] py-3 whitespace-normal border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300 shadow-sm"
                                    onClick={() => {
                                        setEditingTransaction(null);
                                        setFormDefaultValues({ type: 'EXPENSE', paymentMethod: 'CASH', description: '' });
                                        setIsFormOpen(true);
                                    }}
                                >
                                    <Banknote className="mr-2 h-5 w-5 shrink-0" />
                                    Nakit Ödeme
                                </Button>

                                <Button
                                    variant="outline"
                                    className="h-auto min-h-[3rem] py-3 whitespace-normal border-yellow-400 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800 hover:border-yellow-500 shadow-sm"
                                    onClick={() => {
                                        setEditingTransaction(null);
                                        setFormDefaultValues({ type: 'EXPENSE', paymentMethod: 'CREDIT_CARD', description: '' });
                                        setIsFormOpen(true);
                                    }}
                                    disabled={!canCreate} // Disable if no create permission
                                >
                                    <CreditCard className="mr-2 h-5 w-5 shrink-0" />
                                    Kredi Kartı ile Ödeme
                                </Button>

                                <Button
                                    variant="outline"
                                    className="h-auto min-h-[3rem] py-3 whitespace-normal border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-300 shadow-sm"
                                    onClick={() => {
                                        const currentMonthName = format(new Date(), 'MMMM', { locale: tr });
                                        // Capitalize first letter of month
                                        const monthCap = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
                                        setEditingTransaction(null);
                                        setFormDefaultValues({
                                            type: 'INCOME',
                                            paymentMethod: 'CASH',
                                            category: 'Tahsilat',
                                            description: `${monthCap} Ayı Şantiye Harcaması İçin Gönderilen`
                                        });
                                        setIsFormOpen(true);
                                    }}
                                    disabled={!canCreate} // Disable if no create permission
                                >
                                    <Banknote className="mr-2 h-5 w-5 shrink-0" />
                                    Nakit Tahsilat
                                </Button>

                                <Button
                                    className={cn("h-auto min-h-[3rem] py-3 whitespace-normal text-white shadow-sm", showReport ? "bg-slate-700 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700")}
                                    onClick={() => setShowReport(!showReport)}
                                >
                                    <BarChart className="mr-2 h-5 w-5 shrink-0" />
                                    {showReport ? 'Raporu Gizle' : 'Kasa Raporu'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter Row: Grid Layout */}
                {(canViewAll || showReport) && (
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
                                        {sites?.filter((s: any) => s.status === 'ACTIVE' && !s.finalAcceptanceDate && (cashTransactions || []).some((t: any) => t.siteId === s.id && (selectedUserId === 'all' || (t.responsibleUserId || t.createdByUserId) === selectedUserId))).map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* User Filter (Admin or Admin View Perm) - Col 2 */}
                            {canViewAll && (
                                <div className="col-span-12 md:col-span-2">
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="Personel Seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Personel</SelectItem>
                                            {users?.filter((u: any) => (cashTransactions || []).some((t: any) => (t.responsibleUserId || t.createdByUserId) === u.id && (selectedSiteId === 'all' || t.siteId === selectedSiteId))).map((u: any) => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Payment Method Filter - Col 2 */}
                            <div className="col-span-12 md:col-span-2">
                                <Select value={selectedPaymentMethod} onValueChange={(val: any) => setSelectedPaymentMethod(val)}>
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Ödeme Tipi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Nakit</SelectItem>
                                        <SelectItem value="CREDIT_CARD">Kredi Kartı</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Range - Col 3 */}
                            {canExport && (
                                <div className={cn("col-span-12 flex gap-2 items-center", canViewAll ? "md:col-span-3" : "md:col-span-12")}>
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


                        </div>
                    </div>
                )}
            </CardHeader>
            {/* Only show Table Content if Admin, Admin View Perm, or showReport is true */}
            {(canViewAll || showReport) && (
                <CardContent>
                    <div className="mb-4 p-2 bg-slate-50 border rounded text-xs text-muted-foreground flex justify-between items-center">
                        <div>
                            <span className="font-semibold">Devreden Bakiye: </span>
                            {previousBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </div>
                        <div className="text-muted-foreground">
                            Saat: {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table className="text-xs md:text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[70px] md:w-auto">Tarih</TableHead>
                                    {canViewAll && selectedUserId === 'all' && <TableHead>Personel</TableHead>}
                                    <TableHead>Açıklama</TableHead>
                                    <TableHead className="text-right text-green-700">Borç (Gelir)</TableHead>
                                    <TableHead className="text-right text-red-700">Alacak (Gider)</TableHead>
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
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] md:text-sm">{safeFormat(item.date, 'dd.MM.yy')}</span>
                                                    <span className="text-[9px] text-muted-foreground">{safeFormat(item.createdAt, 'HH:mm')}</span>
                                                </div>
                                            </TableCell>
                                            {canViewAll && selectedUserId === 'all' && <TableCell>{item.type === 'BALANCE_START' ? '-' : getUserName(item.responsibleUserId || item.createdByUserId)}</TableCell>}
                                            <TableCell className="max-w-[200px] truncate font-medium" title={item.description}>{item.description}</TableCell>

                                            {/* Borç (Income) */}
                                            <TableCell className="text-right font-mono text-green-600 font-bold whitespace-nowrap">
                                                {(item.type === 'INCOME' || item.type === 'BALANCE_START') ? `${Number(item.amount || 0).toLocaleString('tr-TR')} TL` : '-'}
                                            </TableCell>

                                            {/* Alacak (Expense) */}
                                            <TableCell className="text-right font-mono text-red-600 font-bold whitespace-nowrap">
                                                {item.type === 'EXPENSE' ? `${Number(item.amount || 0).toLocaleString('tr-TR')} TL` : '-'}
                                            </TableCell>

                                            <TableCell className="font-mono font-medium whitespace-nowrap">
                                                {Number(item.balance || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            </TableCell>
                                            <TableCell>
                                                {item.type !== 'BALANCE_START' && (
                                                    <div className="flex items-center gap-1">
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await getTransaction(item.id);
                                                                        if (res.success && res.data) {
                                                                            setEditingTransaction(res.data);
                                                                            setIsFormOpen(true);
                                                                        } else {
                                                                            alert('İşlem detayları alınamadı.');
                                                                        }
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        alert('Bir hata oluştu.');
                                                                    }
                                                                }}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDelete(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            )}

            <CashBookForm
                hideTrigger={true}
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setEditingTransaction(null);
                        setFormDefaultValues(undefined);
                    }
                }}
                initialData={editingTransaction}
                defaultValues={formDefaultValues}
                onSuccess={() => {
                    // Optional: Trigger refresh if needed, but Store update should handle it
                    setEditingTransaction(null);
                }}
            />




        </Card >
    );
}
