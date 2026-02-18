'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, MapPin, Calendar, User as UserIcon, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { FileDown, Loader2, Eye, FileSpreadsheet, FileText } from 'lucide-react'; // Added icons
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { fontBase64, addTurkishFont } from '@/lib/pdf-font';

import { useUserSites } from '@/hooks/use-user-access';

import { createSiteLogEntry, updateSiteLogEntry, deleteSiteLogEntry } from '@/actions/site-log';
import { toast } from 'sonner';

export function SiteLogList({ siteId: filterSiteId }: { siteId?: string }) {
    const { siteLogEntries: rawEntries, users: rawUsers } = useAppStore();
    const rawSites = useUserSites();
    const { user, hasPermission } = useAuth();

    // Safety Wrappers
    const users = rawUsers || [];
    const sites = rawSites || [];

    // [NEW] Filter site log entries by user's authorized sites (non-admin users only see their sites' entries)
    const siteLogEntries = useMemo(() => {
        const entries = rawEntries || [];
        if (user?.role === 'ADMIN') return entries;
        const authorizedSiteIds = sites.map((s: any) => s.id);
        if (authorizedSiteIds.length === 0) return entries; // Fallback: if no sites loaded yet, show all
        return entries.filter((e: any) => authorizedSiteIds.includes(e.siteId));
    }, [rawEntries, user, sites]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const canCreate = hasPermission('site-log', 'CREATE');
    const canEdit = hasPermission('site-log', 'EDIT');
    const canExport = hasPermission('site-log', 'EXPORT');

    // Form State
    const [siteId, setSiteId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [weather, setWeather] = useState('');

    const [content, setContent] = useState('');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [internalSelectedSite, setInternalSelectedSite] = useState<string>('all'); // [NEW]
    const [showAllEntries, setShowAllEntries] = useState(false); // [NEW] Show more for restricted users

    // [NEW] Filtered & Grouped Data
    // const storeEntries = ... (removed redundant)

    const filteredGroups = useMemo(() => {
        const grouped: Record<string, any> = {};

        siteLogEntries.filter((entry: any) => {
            // 1. Site Filter (Prop OR Internal)
            const activeFilterSite = filterSiteId || (internalSelectedSite !== 'all' ? internalSelectedSite : null);
            if (activeFilterSite && entry.siteId !== activeFilterSite) return false;

            // 2. Date Range
            if (filterStartDate && new Date(entry.date) < new Date(filterStartDate)) return false;
            if (filterEndDate && new Date(entry.date) > new Date(filterEndDate)) return false;

            // 3. Search Term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const siteName = (sites.find((s: any) => s.id === entry.siteId)?.name || '').toLowerCase();
                const authorName = (users.find((u: any) => u.id === entry.authorId)?.name || '').toLowerCase();
                const contentLower = (entry.content || '').toLowerCase();
                const weatherLower = (entry.weather || '').toLowerCase();

                if (!contentLower.includes(term) &&
                    !weatherLower.includes(term) &&
                    !siteName.includes(term) &&
                    !authorName.includes(term)) {
                    return false;
                }
            }

            return true;
        }).forEach((entry: any) => {
            const key = `${entry.siteId}_${entry.date}`;
            if (!grouped[key]) {
                grouped[key] = {
                    ...entry,
                    items: []
                };
            }
            grouped[key].items.push(entry);
        });

        const list = Object.values(grouped);

        // Sort Groups
        list.sort((a: any, b: any) => {
            // [FIX] Handle potential date errors
            const d1 = new Date(a.date);
            const d2 = new Date(b.date);
            const timeA = !isNaN(d1.getTime()) ? d1.getTime() : 0;
            const timeB = !isNaN(d2.getTime()) ? d2.getTime() : 0;
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        return list;
    }, [siteLogEntries, filterSiteId, filterStartDate, filterEndDate, searchTerm, sortOrder, sites, users, internalSelectedSite]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // [NEW] Date Restriction Check
        if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                return;
            }
        }

        try {
            if (editingId) {
                const res = await updateSiteLogEntry(editingId, {
                    siteId,
                    date: new Date(date), // Date object expect
                    weather,
                    content
                });
                if (!res.success) {
                    toast.error(res.error);
                    return;
                }
                toast.success('Kayıt güncellendi.');
            } else {
                const res = await createSiteLogEntry({
                    siteId,
                    date: new Date(date),
                    weather,
                    content,
                    authorId: user.id
                });
                if (!res.success) {
                    toast.error(res.error);
                    return;
                }
                toast.success('Kayıt oluşturuldu.');
            }
            setOpen(false);
            resetForm();
        } catch (error) {
            toast.error('Bir hata oluştu.');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setContent('');
        setWeather('');
        setSiteId('');
        setDate(new Date().toISOString().split('T')[0]);
    };

    const handleEdit = (entry: any) => {
        // [NEW] Date Restriction Check
        if (user && user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(entry.date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Bu kayıt ${user.editLookbackDays} günden daha eski olduğu için düzenlenemez.`);
                return;
            }
        }

        setEditingId(entry.id);
        setSiteId(entry.siteId);
        setDate(format(new Date(entry.date), 'yyyy-MM-dd')); // Fix date format for input
        setWeather(entry.weather || '');
        setContent(entry.content);
        setOpen(true);
    };

    const handleDelete = async (id: string, dateStr: string) => {
        // [NEW] Date Restriction Check
        if (user && user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(dateStr);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Bu kayıt ${user.editLookbackDays} günden daha eski olduğu için silinemez.`);
                return;
            }
        }

        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            const res = await deleteSiteLogEntry(id);
            if (res.success) {
                toast.success('Kayıt silindi.');
            } else {
                toast.error(res.error);
            }
        }
    };

    const getSiteName = (id: string) => sites.find((s: any) => s.id === id)?.name || '-';

    const handleDownloadPDF = async (entry: any, isPreview: boolean = false) => {
        try {
            setIsGeneratingPDF(true);
            const doc = new jsPDF('p', 'mm', 'a4');

            // 1. Load Custom Font (Roboto) from Base64 with Identity-H encoding
            addTurkishFont(doc);
            doc.setFont('Roboto', 'bold');

            const siteName = getSiteName(entry.siteId);
            const dateStr = format(new Date(entry.date), 'dd.MM.yyyy', { locale: tr });
            const dayName = format(new Date(entry.date), 'EEEE', { locale: tr });

            // Calculate "Entry Page Number" logic (Business Logic)
            // Filter entries by site first
            const allSiteEntries = siteLogEntries.filter((e: any) => e.siteId === entry.siteId);
            const siteEntries = filterSiteId
                ? allSiteEntries.filter((e: any) => e.siteId === filterSiteId)
                : allSiteEntries;

            const uniqueDates = Array.from(new Set(siteEntries.map((e: any) => e.date))).sort();
            const dateIndex = uniqueDates.indexOf(entry.date);
            const pageNumber = dateIndex !== -1 ? dateIndex + 1 : 1;
            const dayEntries = siteEntries.filter((e: any) => e.date === entry.date);

            // Draw Template Function
            const drawTemplate = (currentSheet: number) => {
                doc.setFontSize(14);
                // 1. Header
                doc.setFont('Roboto', 'bold');
                doc.text("ŞANTİYE GÜNLÜK DEFTERİ", 105, 15, { align: 'center' });

                // 2. Info Box (Top)
                doc.setLineWidth(0.3);
                doc.rect(20, 20, 170, 16); // Main Box
                doc.line(20, 28, 190, 28); // Horizontal Line
                doc.line(135, 20, 135, 28); // Vertical Line for Page No

                // Labels & Values - Row 1
                doc.setFontSize(9);
                doc.setFont('Roboto', 'bold');
                doc.text("TARİH ve GÜN", 22, 25);

                doc.setFont('Roboto', 'normal');
                doc.text(`: ${dateStr} ${dayName}`, 55, 25);

                doc.setFont('Roboto', 'bold');
                doc.text("SAYFA NO", 137, 25);
                doc.setFont('Roboto', 'normal');
                doc.text(`: ${pageNumber}`, 155, 25); // [MOD] Removed (${currentSheet})

                // Row 2
                const uniqueWeather = Array.from(new Set(dayEntries.map((e: any) => e.weather).filter(Boolean)));
                const weatherStr = uniqueWeather.length > 0 ? uniqueWeather.join(', ') : '-';

                doc.setFont('Roboto', 'bold');
                doc.text("HAVA DURUMU", 22, 33);

                doc.setFont('Roboto', 'normal');
                doc.text(`: ${weatherStr}`, 55, 33);

                // 3. Content Area Frame
                const contentBoxTop = 36;
                const contentBoxHeight = 200;
                doc.rect(20, contentBoxTop, 170, contentBoxHeight); // Main Content Box Frame

                // DRAW LINES (Ruled Paper Effect)
                const lineHeight = 7; // Distance between lines in mm
                const startLineY = contentBoxTop + lineHeight;
                const endLineY = contentBoxTop + contentBoxHeight;

                doc.setDrawColor(200, 200, 200); // Light gray for lines
                for (let y = startLineY; y < endLineY; y += lineHeight) {
                    doc.line(20, y, 190, y);
                }
                doc.setDrawColor(0, 0, 0); // Reset to black

                // 4. Footer (Signatures)
                const footerY = contentBoxTop + contentBoxHeight; // 236
                const footerHeight = 30;

                doc.rect(20, footerY, 170, footerHeight); // Footer Container

                const boxWidth = 170 / 3;

                // Vertical dividers
                doc.line(20 + boxWidth, footerY, 20 + boxWidth, footerY + footerHeight);
                doc.line(20 + boxWidth * 2, footerY, 20 + boxWidth * 2, footerY + footerHeight);

                doc.setFont('Roboto', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0); // Reset black

                // Titles
                doc.text("ŞANTİYE ŞEFİ", 20 + (boxWidth / 2), footerY + 6, { align: 'center' });
                doc.text("MÜTEAHHİT", 20 + boxWidth + (boxWidth / 2), footerY + 6, { align: 'center' });
                doc.text("KONTROL MÜHENDİSİ", 20 + (boxWidth * 2) + (boxWidth / 2), footerY + 6, { align: 'center' });
            };

            // Start Logic
            let currentSheet = 1;
            drawTemplate(currentSheet);

            const contentBoxTop = 36;
            const contentBoxHeight = 200;
            const endContentY = contentBoxTop + contentBoxHeight;
            let currentY = contentBoxTop + 5.5;

            dayEntries.forEach((dayEntry: any, index: any) => {
                const bullet = "• ";
                const rawContent = dayEntry.content || '';
                const contentText = bullet + rawContent;

                // [FIX] Set font/size BEFORE calculating split to ensure correct metrics
                doc.setFont('Roboto', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                // [FIX] Reduced width from 165 to 158 to prevent right-overflow
                // [FIX] Match background line height (7mm)
                const lineSpacing = 7;

                doc.setFont('Roboto', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                const splitText = doc.splitTextToSize(contentText, 158);

                for (let i = 0; i < splitText.length; i++) {
                    const line = splitText[i];
                    if (currentY + lineSpacing > endContentY - 2) {
                        doc.addPage();
                        currentSheet++;
                        drawTemplate(currentSheet);
                        currentY = contentBoxTop + 5.5;
                    }

                    // [FIX] Justify alignment for all lines except the last one
                    if (i < splitText.length - 1) {
                        doc.text(line, 22, currentY, { align: 'justify', maxWidth: 158 });
                    } else {
                        doc.text(line, 22, currentY);
                    }

                    currentY += lineSpacing;
                }

                // Author
                const author = users.find((u: any) => u.id === dayEntry.authorId);
                const authorName = author ? author.name : 'Bilinmeyen Kullanıcı';
                const authorStr = ` - ${authorName}`;

                const lastLine = splitText[splitText.length - 1] || '';
                const lastLineWidth = doc.getTextWidth(lastLine);
                const authorWidth = doc.getTextWidth(authorStr);

                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);

                let authorX = 22 + lastLineWidth + 1;
                let authorY = currentY - lineSpacing;

                if (authorX + authorWidth > 190) {
                    authorX = 22;
                    if (currentY + lineSpacing > endContentY - 2) {
                        doc.addPage();
                        currentSheet++;
                        drawTemplate(currentSheet);
                        currentY = contentBoxTop + 5.5;
                        authorY = currentY;
                        currentY += lineSpacing;
                    } else {
                        authorY = currentY;
                        currentY += lineSpacing;
                    }
                }

                doc.text(authorStr, authorX, authorY);
                doc.setTextColor(0, 0, 0);

                if (index < dayEntries.length - 1) {
                    currentY += 2;
                    // [FIX] Snap currentY to the nearest ruled line to prevent drift
                    const baseY = contentBoxTop + 5.5;
                    currentY = Math.ceil((currentY - baseY) / lineSpacing) * lineSpacing + baseY;
                    if (currentY > endContentY - 4) {
                        doc.addPage();
                        currentSheet++;
                        drawTemplate(currentSheet);
                        currentY = contentBoxTop + 5.5;
                    }
                }
            });

            if (isPreview) {
                window.open(doc.output('bloburl'), '_blank');
            } else {
                doc.save(`Santiye_Defteri_${dateStr}.pdf`);
            }
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('PDF oluşturulurken bir hata oluştu. İnternet bağlantınızı kontrol ediniz (Font yüklemesi için gereklidir).');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const exportExcel = () => {
        const data = siteLogEntries.map((e: any) => ({
            'Tarih': format(new Date(e.date), 'dd.MM.yyyy', { locale: tr }),
            'Şantiye': getSiteName(e.siteId),
            'Hava': e.weather,
            'İçerik': e.content,
            'Kaydeden': users.find((u: any) => u.id === e.authorId)?.name || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Şantiye Defteri");
        XLSX.writeFile(wb, `santiye-defteri-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportListPDF = () => {
        const doc = new jsPDF();
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const tableColumn = ["Tarih", "Şantiye", "Hava", "İçerik"];
        const tableRows = siteLogEntries.map((e: any) => [
            format(new Date(e.date), 'dd.MM.yyyy', { locale: tr }),
            getSiteName(e.siteId),
            e.weather,
            e.content.substring(0, 100) + (e.content.length > 100 ? '...' : '') // Truncate content
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text("Şantiye Defteri Listesi", 14, 15);
        doc.save(`santiye-defteri-listesi-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between">
                        {user?.role === 'ADMIN' && <CardTitle>Şantiye Defteri Kayıtları</CardTitle>}
                        <div className="flex gap-2">
                            {canExport && (
                                <>
                                    <Button variant="outline" size="sm" onClick={exportListPDF} disabled={isGeneratingPDF} title="Listeyi PDF İndir">
                                        {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2 text-red-600" />}
                                        Liste PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={exportExcel} title="Listeyi Excel İndir">
                                        <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                                        Liste Excel
                                    </Button>
                                </>
                            )}
                            {canCreate && (
                                <Dialog open={open} onOpenChange={(val) => {
                                    if (!val) resetForm();
                                    setOpen(val);
                                }}>
                                    {canCreate && (
                                        <DialogTrigger asChild>
                                            <Button className="bg-blue-600 hover:bg-blue-700">
                                                <Plus className="w-4 h-4 mr-2" /> Yeni Kayıt
                                            </Button>
                                        </DialogTrigger>
                                    )}
                                    <DialogContent className="sm:max-w-[600px]">
                                        <DialogHeader>
                                            <DialogTitle>{editingId ? 'Kaydı Düzenle' : 'Şantiye Defteri Girişi'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Şantiye</Label>
                                                    <Select value={siteId} onValueChange={setSiteId} required>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seçiniz" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Tarih</Label>
                                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Hava Durumu</Label>
                                                <Input placeholder="Örn: Güneşli, 25°C" value={weather} onChange={e => setWeather(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Günlük Rapor / Notlar</Label>
                                                <Textarea
                                                    className="h-32"
                                                    placeholder="Bugün yapılan işler, malzemeler, olaylar..."
                                                    value={content}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setContent(val.charAt(0).toUpperCase() + val.slice(1));
                                                    }}
                                                    required
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit">Kaydet</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    {user?.role === 'ADMIN' && (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-50 border rounded-lg">
                            <div className="col-span-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">Ara</Label>
                                <Input
                                    placeholder="İçerik, hava durumu..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-white"
                                />
                            </div>

                            {/* [NEW] Site Filter */}
                            {!filterSiteId && (
                                <div className="col-span-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Şantiye</Label>
                                    <Select value={internalSelectedSite} onValueChange={setInternalSelectedSite}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Tümü" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tümü</SelectItem>
                                            {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="col-span-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">Başlangıç Tarihi</Label>
                                <Input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="col-span-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">Bitiş Tarihi</Label>
                                <Input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="col-span-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">Sıralama</Label>
                                <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="desc">Yeniden Eskiye</SelectItem>
                                        <SelectItem value="asc">Eskiden Yeniye</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {filteredGroups.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">Kayıt bulunamadı.</div>
                        ) : (
                            (() => {
                                const isAdmin = user?.role === 'ADMIN';
                                // Restricted users: max 3 entries, show 2 initially
                                const limitedGroups = isAdmin ? filteredGroups : filteredGroups.slice(0, 3);
                                const displayGroups = isAdmin ? limitedGroups : (showAllEntries ? limitedGroups : limitedGroups.slice(0, 2));
                                const hasMore = !isAdmin && !showAllEntries && limitedGroups.length > 2;
                                return (
                                    <>
                                        {displayGroups.map((group: any) => (
                                            <div key={group.id} className="border rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-sm font-semibold text-blue-900 flex items-center gap-2 max-w-[180px] truncate">
                                                            <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                            <span className="truncate">{getSiteName(group.siteId)}</span>
                                                        </div>
                                                        <span className="text-sm text-slate-400">|</span>
                                                        <div className="text-sm text-slate-600 flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-slate-400" />
                                                            {format(new Date(group.date), 'dd.MM.yyyy')}
                                                        </div>
                                                        {/* Show all weather info if different, or just first? User requested combined look. Let's join unique weathers. */}
                                                        {(() => {
                                                            const uniqueWeather = Array.from(new Set(group.items.map((i: any) => i.weather).filter(Boolean)));
                                                            if (uniqueWeather.length > 0) {
                                                                return (
                                                                    <>
                                                                        <span className="text-sm text-slate-400">|</span>
                                                                        <span className="text-sm text-slate-600">{uniqueWeather.join(', ')}</span>
                                                                    </>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>

                                                    {/* Action Buttons for the Whole Group (PDF) */}
                                                    {canExport && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-slate-600 hover:text-blue-600"
                                                                onClick={() => handleDownloadPDF(group, true)}
                                                                title="Önizle"
                                                                disabled={isGeneratingPDF}
                                                            >
                                                                {isGeneratingPDF ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                                                Önizle
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-slate-600 hover:text-green-600"
                                                                onClick={() => handleDownloadPDF(group, false)}
                                                                title="PDF İndir"
                                                                disabled={isGeneratingPDF}
                                                            >
                                                                {isGeneratingPDF ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileDown className="w-3 h-3 mr-1" />}
                                                                PDF İndir
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Compact Entry List */}
                                                <div className="space-y-1.5">
                                                    {group.items.map((entry: any) => {
                                                        const authorName = users.find((u: any) => u.id === entry.authorId)?.name || 'Bilinmeyen';
                                                        const snippet = entry.content
                                                            ? entry.content.replace(/\n/g, ' ').substring(0, 120) + (entry.content.length > 120 ? '...' : '')
                                                            : '';
                                                        return (
                                                            <div key={entry.id} className="flex items-center gap-2 pl-3 border-l-2 border-slate-200 py-1.5 group hover:bg-slate-50 rounded-r transition-colors">
                                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                    <UserIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                                    <span className="text-xs font-semibold text-blue-800 whitespace-nowrap">{authorName}</span>
                                                                    <span className="text-xs text-slate-400 flex-shrink-0">—</span>
                                                                    <span className="text-sm text-slate-600 truncate">{snippet}</span>
                                                                </div>
                                                                {canEdit && (user?.id === entry.authorId || user?.role === 'ADMIN') && (
                                                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(entry)}>
                                                                            <Pencil className="w-3 h-3" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDelete(entry.id, entry.date)}>
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                        {hasMore && (
                                            <div className="flex justify-center pt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowAllEntries(true)}
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                >
                                                    Devamını Gör ({limitedGroups.length - 2} kayıt daha)
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
