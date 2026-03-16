import { useState } from 'react';
import { useAuth } from '@/lib/store/use-auth'; // [NEW] - Added import
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FileText, MapPin, Calendar, User, Eye, Loader2, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { PDFPreview } from '@/components/shared/PDFPreview';

import jsPDF from 'jspdf';
import { fontBase64, addTurkishFont } from '@/lib/pdf-font';


interface SiteLogSummaryProps {
    siteLogEntries: any[];
    sites: any[];
    users: any[];
}

export function SiteLogSummary({ siteLogEntries, sites, users }: SiteLogSummaryProps) {
    const { user, hasPermission } = useAuth(); // [NEW] - Auth hook
    const canPrint = user?.role === 'ADMIN' || hasPermission('dashboard', 'EDIT') || hasPermission('dashboard.site-log', 'VIEW'); // [UPDATED] - Allow view permission to print

    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewBase64, setPreviewBase64] = useState<string | null>(null);

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

    const handleDownloadPDF = async (entry: any, isPreview: boolean = false) => {
        try {
            setIsGenerating(entry.id);
            const doc = new jsPDF('p', 'mm', 'a4');

            // Load Custom Font (Roboto) with Identity-H encoding for Turkish characters
            addTurkishFont(doc);

            doc.setFont('Roboto', 'bold');

            const siteName = sites.find(s => s.id === entry.siteId)?.name || '-';
            const dateStr = format(new Date(entry.date), 'dd.MM.yyyy', { locale: tr });
            const dayName = format(new Date(entry.date), 'EEEE', { locale: tr });

            // Find all entries for this specific day and site
            const allSiteEntries = siteLogEntries.filter((e: any) => e.siteId === entry.siteId);
            const uniqueDates = Array.from(new Set(allSiteEntries.map((e: any) => e.date))).sort();
            const dateIndex = uniqueDates.indexOf(entry.date);
            const pageNumber = dateIndex !== -1 ? dateIndex + 1 : 1;
            const dayEntries = allSiteEntries.filter((e: any) => e.date === entry.date);

            const drawTemplate = (currentSheet: number) => {
                doc.setFontSize(14);
                // 1. Header
                doc.setFont('Roboto', 'bold');
                doc.text("ŞANTİYE GÜNLÜK DEFTERİ", 105, 15, { align: 'center' });

                // 2. Info Box (Top)
                doc.setLineWidth(0.3);
                doc.rect(20, 20, 170, 16);
                doc.line(20, 28, 190, 28);
                doc.line(135, 20, 135, 28);

                // Labels & Values - Row 1
                doc.setFontSize(9);
                doc.setFont('Roboto', 'bold');
                doc.text("TARİH ve GÜN", 22, 25);

                doc.setFont('Roboto', 'normal');
                doc.text(`: ${dateStr} ${dayName}`, 55, 25);

                doc.setFont('Roboto', 'bold');
                doc.text("SAYFA NO", 137, 25);
                doc.setFont('Roboto', 'normal');
                doc.text(`: ${pageNumber}`, 155, 25);

                // Row 2
                const uniqueWeather = Array.from(new Set(dayEntries.map((e: any) => e.weather).filter(Boolean)));
                const weatherStr = uniqueWeather.length > 0 ? (uniqueWeather as string[]).join(', ') : '-';

                doc.setFont('Roboto', 'bold');
                doc.text("HAVA DURUMU", 22, 33);

                doc.setFont('Roboto', 'normal');
                doc.text(`: ${weatherStr}`, 55, 33);

                // 3. Content Area Frame
                const contentBoxTop = 36;
                const contentBoxHeight = 200;
                doc.rect(20, contentBoxTop, 170, contentBoxHeight);

                // DRAW LINES
                const lineHeight = 7;
                const startLineY = contentBoxTop + lineHeight;
                const endLineY = contentBoxTop + contentBoxHeight;

                doc.setDrawColor(200, 200, 200);
                for (let y = startLineY; y < endLineY; y += lineHeight) {
                    doc.line(20, y, 190, y);
                }
                doc.setDrawColor(0, 0, 0);

                // 4. Footer
                const footerY = contentBoxTop + contentBoxHeight;
                const footerHeight = 30;

                doc.rect(20, footerY, 170, footerHeight);
                const boxWidth = 170 / 3;

                doc.line(20 + boxWidth, footerY, 20 + boxWidth, footerY + footerHeight);
                doc.line(20 + boxWidth * 2, footerY, 20 + boxWidth * 2, footerY + footerHeight);

                doc.setFont('Roboto', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);

                doc.text("ŞANTİYE ŞEFİ", 20 + (boxWidth / 2), footerY + 6, { align: 'center' });
                doc.text("MÜTEAHHİT", 20 + boxWidth + (boxWidth / 2), footerY + 6, { align: 'center' });
                doc.text("KONTROL MÜHENDİSİ", 20 + (boxWidth * 2) + (boxWidth / 2), footerY + 6, { align: 'center' });
            };

            let currentSheet = 1;
            drawTemplate(currentSheet);

            const contentBoxTop = 36;
            const contentBoxHeight = 200;
            const endContentY = contentBoxTop + contentBoxHeight;
            let currentY = contentBoxTop + 5.5;

            dayEntries.forEach((dayEntry: any, index: number) => {
                const bullet = "• ";
                const rawContent = dayEntry.content || '';
                const contentText = bullet + rawContent;

                doc.setFont('Roboto', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                const lineSpacing = 7;

                const splitText = doc.splitTextToSize(contentText, 158);

                for (let i = 0; i < splitText.length; i++) {
                    const line = splitText[i];
                    if (currentY + lineSpacing > endContentY - 2) {
                        doc.addPage();
                        currentSheet++;
                        drawTemplate(currentSheet);
                        currentY = contentBoxTop + 5.5;
                    }

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
                    // Snap currentY to the nearest ruled line to prevent drift
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
                setPreviewBase64(doc.output('datauristring'));
                setIsPreviewOpen(true);
            } else {
                doc.save(`Santiye_Defteri_${dateStr}.pdf`);
            }
        } catch (error) {
            console.error('PDF Error:', error);
            alert('PDF oluşturulamadı.');
        } finally {
            setIsGenerating(null);
        }
    };

    if (logsBySite.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Şantiye Günlük Defteri Özetleri
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
                {logsBySite.map(({ site, logs }: any) => {
                    // Group logs by date locally for display
                    const logsByDate = logs.reduce((acc: any, log: any) => {
                        const dateKey = log.date.split('T')[0];
                        if (!acc[dateKey]) {
                            acc[dateKey] = {
                                date: log.date,
                                weather: log.weather,
                                items: []
                            };
                        }
                        acc[dateKey].items.push(log);
                        return acc;
                    }, {});

                    return (
                        <Card key={site.id} className="flex flex-col h-full border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2 bg-blue-50/50 border-b border-blue-50 rounded-t-lg">
                                <CardTitle className="text-sm font-bold text-blue-900 flex items-center gap-2 min-w-0">
                                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    <span className="truncate flex-1" title={site.name}>{site.name}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3 flex-1">
                                <div className="space-y-4">
                                    {Object.values(logsByDate)
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((group: any) => {
                                            const firstItem = group.items[0];
                                            const isItemLoading = isGenerating === firstItem.id; // Just track first for loading visual

                                            return (
                                                <div key={group.date} className="relative pl-3 border-l-2 border-slate-200 py-1">
                                                    {/* Row 1: Date | Preview Icon */}
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1 font-medium text-slate-700 text-xs">
                                                            <Calendar className="w-3 h-3 text-blue-500" />
                                                            {format(new Date(group.date), 'dd MMMM yyyy', { locale: tr })}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={canPrint ? "h-6 w-6 text-slate-400 hover:text-blue-600" : "h-6 w-6 text-slate-200 cursor-not-allowed"} // [UPDATED] - Logic check
                                                            title="Önizle (Tüm Gün)"
                                                            onClick={(e) => {
                                                                if (!canPrint) {
                                                                    e.preventDefault();
                                                                    return;
                                                                }
                                                                handleDownloadPDF(firstItem, true);
                                                            }}
                                                            disabled={isItemLoading || !canPrint}// [UPDATED] - Logic check
                                                        >
                                                            {isItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </Button>
                                                    </div>

                                                    {/* Row 2: Weather (Combined or First) */}
                                                    {group.weather && (
                                                        <div className="mb-1.5">
                                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded inline-block max-w-full truncate" title={group.weather}>
                                                                {group.weather}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Row 3: Compact Entries */}
                                                    <div className="space-y-1">
                                                        {group.items.map((log: any) => {
                                                            const author = users.find((u: any) => u.id === log.authorId);
                                                            const snippet = log.content
                                                                ? log.content.replace(/\n/g, ' ').substring(0, 100) + (log.content.length > 100 ? '...' : '')
                                                                : '';
                                                            return (
                                                                <div key={log.id} className="flex items-center gap-1.5 min-w-0">
                                                                    <User className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                                    <span className="text-[11px] font-semibold text-blue-800 whitespace-nowrap">{author?.name || 'Bilinmeyen'}</span>
                                                                    <span className="text-[10px] text-slate-400 flex-shrink-0">—</span>
                                                                    <span className="text-xs text-slate-600 truncate" title={log.content}>{snippet}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-none w-screen !max-w-none h-[100dvh] p-0 border-none bg-white shadow-none fixed inset-0 z-[200] !translate-x-0 !translate-y-0 left-0 top-0 overflow-x-hidden m-0">
                    <DialogTitle className="sr-only">PDF Ön İzleme</DialogTitle>
                    {/* Floating Close Button */}
                    <div className="fixed bottom-10 right-10 z-[210] sm:hidden">
                        <DialogClose asChild>
                            <Button variant="secondary" size="lg" className="bg-slate-900/90 hover:bg-slate-900 text-white font-bold shadow-2xl rounded-full px-6 h-12 border border-white/30 backdrop-blur-md">
                                <XIcon className="w-5 h-5 mr-2" /> Kapat
                            </Button>
                        </DialogClose>
                    </div>

                    <div className="h-full w-full relative">
                        {previewBase64 && <PDFPreview base64={previewBase64} />}
                        
                        {/* Desktop Close Button */}
                        <div className="absolute top-6 right-8 z-[50] hidden sm:block">
                            <DialogClose asChild>
                                <Button variant="outline" size="icon" className="rounded-full h-10 w-10 bg-white/80 backdrop-blur hover:bg-white shadow-md border-slate-200">
                                    <XIcon className="w-5 h-5 text-slate-600" />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
