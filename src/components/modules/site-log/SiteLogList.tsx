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

import { useUserSites } from '@/hooks/use-user-access';

export function SiteLogList() {
    const { siteLogEntries, addSiteLogEntry, updateSiteLogEntry, deleteSiteLogEntry } = useAppStore();
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
                                        onChange={e => setContent(e.target.value)}
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
