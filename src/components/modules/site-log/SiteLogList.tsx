'use client';

import { useState } from 'react';
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
import { FileDown, Loader2, Eye } from 'lucide-react'; // Added Eye for preview

import { useUserSites } from '@/hooks/use-user-access';

export function SiteLogList() {
    const { siteLogEntries, addSiteLogEntry, updateSiteLogEntry, deleteSiteLogEntry, users } = useAppStore();
    const sites = useUserSites();
    const { user, hasPermission } = useAuth();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const canCreate = hasPermission('site-log', 'CREATE');
    const canEdit = hasPermission('site-log', 'EDIT');

    // Form State
    const [siteId, setSiteId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [weather, setWeather] = useState('');

    const [content, setContent] = useState('');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
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

        if (editingId) {
            updateSiteLogEntry(editingId, {
                siteId,
                date,
                weather,
                content
            });
        } else {
            addSiteLogEntry({
                id: crypto.randomUUID(),
                siteId,
                date,
                weather,
                content,
                authorId: user.id
            });
        }
        setOpen(false);
        resetForm();
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
        setDate(entry.date);
        setWeather(entry.weather || '');
        setContent(entry.content);
        setOpen(true);
    };

    const handleDelete = (id: string, dateStr: string) => {
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
            deleteSiteLogEntry(id);
        }
    };

    const getSiteName = (id: string) => sites.find(s => s.id === id)?.name || '-';

    const handleDownloadPDF = async (entry: any, isPreview: boolean = false) => {
        try {
            setIsGeneratingPDF(true);
            const doc = new jsPDF('p', 'mm', 'a4');

            // 1. Load Custom Font (Roboto) for Turkish Character Support
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
            const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

            const loadFont = async (url: string, name: string, style: string) => {
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                const binary = new Uint8Array(buffer);
                let binaryString = "";
                for (let i = 0; i < binary.length; i++) {
                    binaryString += String.fromCharCode(binary[i]);
                }
                const base64 = window.btoa(binaryString);

                doc.addFileToVFS(`${name}.ttf`, base64);
                doc.addFont(`${name}.ttf`, name, style);
            };

            await Promise.all([
                loadFont(fontUrl, 'Roboto', 'normal'),
                loadFont(fontUrlBold, 'Roboto', 'bold')
            ]);

            doc.setFont('Roboto', 'bold');

            const siteName = getSiteName(entry.siteId);
            const dateStr = format(new Date(entry.date), 'dd.MM.yyyy', { locale: tr });
            const dayName = format(new Date(entry.date), 'EEEE', { locale: tr });

            // Calculate Page Number (Based on Unique Dates)
            const siteEntries = siteLogEntries.filter(e => e.siteId === entry.siteId);
            const uniqueDates = Array.from(new Set(siteEntries.map(e => e.date))).sort();
            const dateIndex = uniqueDates.indexOf(entry.date);
            const pageNumber = dateIndex !== -1 ? dateIndex + 1 : 1;

            // Fonts & Layout
            doc.setFontSize(14);

            // 1. Header
            doc.text("ŞANTİYE GÜNLÜK DEFTERİ", 105, 15, { align: 'center' });

            // 2. Info Box (Top)
            doc.setLineWidth(0.3);
            doc.rect(20, 20, 170, 16); // Main Box

            // Horizontal Line inside Info Box
            doc.line(20, 28, 190, 28);

            // Vertical Line for Page No
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
            // Consolidate Weather? Use the current entry's weather or join them?
            // User entered weather for *this* entry. If multiple people enter logs, weather might differ or be same.
            // Let's use the weather from the entry triggering the download, or join unique weathers.
            const dayEntries = siteEntries.filter(e => e.date === entry.date);
            // Sort by creation or something consistent. Let's assume array order is roughly creation order.

            const uniqueWeather = Array.from(new Set(dayEntries.map(e => e.weather).filter(Boolean)));
            const weatherStr = uniqueWeather.length > 0 ? uniqueWeather.join(', ') : '-';

            doc.setFont('Roboto', 'bold');
            doc.text("HAVA DURUMU", 22, 33);

            doc.setFont('Roboto', 'normal');
            doc.text(`: ${weatherStr}`, 55, 33);

            // 3. Content Area
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

            // Content Text Iteration
            let currentY = contentBoxTop + 6;

            dayEntries.forEach((dayEntry, index) => {
                const bullet = "• ";
                const rawContent = dayEntry.content || '';
                // Ensure content starts with bullet
                const contentText = bullet + rawContent;

                const splitText = doc.splitTextToSize(contentText, 165);

                doc.setFont('Roboto', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);

                const lineHeight = doc.getLineHeight() * 0.3527; // pt to mm approx
                const lineSpacing = 4.5;

                doc.text(splitText, 22, currentY, { lineHeightFactor: 1.15 });

                // Calculate end position of the last line
                const lastLine = splitText[splitText.length - 1] || '';
                const lastLineWidth = doc.getTextWidth(lastLine);

                // Author Style
                doc.setFont('Roboto', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150); // Gray

                const author = users.find(u => u.id === dayEntry.authorId);
                const authorName = author ? author.name : 'Bilinmeyen Kullanıcı';
                const authorStr = ` - ${authorName}`;

                const authorWidth = doc.getTextWidth(authorStr);

                // 22 (Left) + 170 (Width) = 192 (Right Boundary). Let's say 190 margin.
                let authorX = 22 + lastLineWidth + 1;
                let authorY = currentY + (splitText.length - 1) * lineSpacing;

                // Check overflow
                if (authorX + authorWidth > 190) {
                    authorX = 22; // Wrap to next line, indented? No, just start of line
                    authorY += lineSpacing;
                }

                doc.text(authorStr, authorX, authorY);

                // Update Y for next entry
                // If we wrapped author, we added a line.
                // Also splitText.length is number of lines of content.
                // Logic: currentY is start. (splitText.length - 1) * lineSpacing is Y of last content line.
                // If we stay on same line, total height is determined by content.
                // If we wrap, we add one line spacing.

                let totalHeight = (splitText.length - 1) * lineSpacing;
                if (authorX === 22) { // We wrapped
                    totalHeight += lineSpacing;
                }

                currentY += totalHeight + 6; // +6 for spacing between entries (paragraph gap)

                // Separator if not last
                if (index < dayEntries.length - 1) {
                    // Maybe a small dashed line? Or just space. 
                    // User said "alt alta", simple spacing is usually enough.
                    // Let's check boundary
                    if (currentY > endLineY - 10) {
                        // Overflow warning or new page? 
                        // For now, no multi-page logic requested, just stop or let overflow (hidden by clip usually or flows out).
                    }
                }
            });


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

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Şantiye Defteri Kayıtları</CardTitle>
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
                                                {sites.filter(s => s.status === 'ACTIVE').map(s => (
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
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {siteLogEntries.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">Kayıt bulunamadı.</div>
                        ) : (
                            siteLogEntries.map(entry => (
                                <div key={entry.id} className="border rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="font-semibold text-blue-900 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-blue-500" />
                                                {getSiteName(entry.siteId)}
                                            </div>
                                            <span className="text-sm text-slate-400">|</span>
                                            <div className="text-sm text-slate-600 flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {format(new Date(entry.date), 'dd MMMM yyyy', { locale: tr })}
                                            </div>
                                            {entry.weather && (
                                                <>
                                                    <span className="text-sm text-slate-400">|</span>
                                                    <span className="text-sm text-slate-600">{entry.weather}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-wrap">{entry.content}</p>
                                    <div className="mt-4 flex justify-between items-end">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                                onClick={() => handleDownloadPDF(entry, true)}
                                                title="Önizle"
                                                disabled={isGeneratingPDF}
                                            >
                                                {isGeneratingPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-green-600"
                                                onClick={() => handleDownloadPDF(entry, false)}
                                                title="PDF İndir"
                                                disabled={isGeneratingPDF}
                                            >
                                                {isGeneratingPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                                            </Button>
                                            {canEdit && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(entry)}>
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDelete(entry.id, entry.date)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1">
                                            <UserIcon className="w-3 h-3" /> Kaydeden: {user?.name || 'Unknown'} (ID: {entry.authorId})
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
