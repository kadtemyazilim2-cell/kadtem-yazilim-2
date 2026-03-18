
'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Search,
    Users,
    MapPin,
    Briefcase,
    Filter,
    Plus,
    X,
    Loader2
} from 'lucide-react';
import { addPersonnelToSite, removePersonnelFromSite } from '@/actions/personnel';
import { toast } from 'sonner';

export default function PersonnelAssignment() {
    const { personnel, sites, addPersonnelToSite: updateStoreAdd, removePersonnelFromSite: updateStoreRemove } = useAppStore();
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [assignedSearch, setAssignedSearch] = useState('');
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    // Filter Logic
    const availablePersonnel = useMemo(() => {
        return personnel
            .filter(p => {
                // Not assigned to selected site
                const isAssignedToThis = p.assignedSiteIds?.includes(selectedSiteId) ||
                                         p.assignedSites?.some((s: any) => s.id === selectedSiteId) ||
                                         p.siteId === selectedSiteId;
                if (isAssignedToThis) return false;

                // Status check (Active only?)
                if (p.status === 'LEFT') return false;

                // Search
                const searchLower = search.toLocaleLowerCase('tr-TR');
                return (
                    p.fullName.toLocaleLowerCase('tr-TR').includes(searchLower) ||
                    (p.role || '').toLocaleLowerCase('tr-TR').includes(searchLower) ||
                    (p.tcNumber || '').includes(searchLower)
                );
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
    }, [personnel, selectedSiteId, search]);

    const assignedPersonnel = useMemo(() => {
        if (!selectedSiteId) return [];
        return personnel
            .filter(p => {
                const isAssigned = p.assignedSiteIds?.includes(selectedSiteId) ||
                                   p.assignedSites?.some((s: any) => s.id === selectedSiteId) ||
                                   p.siteId === selectedSiteId;
                if (!isAssigned || p.status === 'LEFT') return false;

                const searchLower = assignedSearch.toLocaleLowerCase('tr-TR');
                if (searchLower) {
                    return (
                        p.fullName.toLocaleLowerCase('tr-TR').includes(searchLower) ||
                        (p.role || '').toLocaleLowerCase('tr-TR').includes(searchLower) ||
                        (p.tcNumber || '').includes(searchLower)
                    );
                }
                return true;
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
    }, [personnel, selectedSiteId, assignedSearch]);

    // Handlers
    const handleAssign = async (ids: string[]) => {
        if (!selectedSiteId || ids.length === 0) return;

        setLoadingIds(prev => ({ ...prev, [ids[0]]: true }));

        try {
            const result = await addPersonnelToSite(ids, selectedSiteId);
            if (result.success) {
                updateStoreAdd(ids, selectedSiteId);
                toast.success('Personel şantiyeye atandı.');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Atama sırasında hata oluştu.');
        } finally {
            setLoadingIds(prev => ({ ...prev, [ids[0]]: false }));
        }
    };

    const handleRemove = async (ids: string[]) => {
        if (!selectedSiteId || ids.length === 0) return;

        if (!confirm('Personeli şantiyeden çıkarmak istediğinize emin misiniz?')) return;

        setLoadingIds(prev => ({ ...prev, [ids[0]]: true }));

        try {
            const result = await removePersonnelFromSite(ids, selectedSiteId);
            if (result.success) {
                updateStoreRemove(ids, selectedSiteId);
                toast.success('Personel şantiyeden çıkarıldı.');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Çıkarma sırasında hata oluştu.');
        } finally {
            setLoadingIds(prev => ({ ...prev, [ids[0]]: false }));
        }
    };

    // Get active site name for badges
    const getSiteName = (id: string | null) => {
        if (!id) return null;
        return sites.find(s => s.id === id)?.name;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Site Selection */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Personel Atama Yönetimi</h2>
                        <p className="text-sm text-muted-foreground">Personelleri şantiyeler arasında görevlendirin.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                        <SelectTrigger className="w-full md:w-[300px] h-11">
                            <SelectValue placeholder="Şantiye Seçiniz..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sites.filter(s => s.status === 'ACTIVE').map(site => (
                                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedSiteId && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                    {/* LEFT: Assigned Personnel */}
                    <Card className="flex flex-col h-full border-solid border-2 border-primary/20 shadow-md">
                        <CardHeader className="pb-3 bg-primary/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-primary" />
                                    Şantiyedeki Personel
                                    <Badge className="ml-2 bg-primary">{assignedPersonnel.length}</Badge>
                                </CardTitle>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary/50" />
                                <Input
                                    placeholder="Atananlarda ara..."
                                    className="pl-9 border-primary/20 focus-visible:ring-primary/30"
                                    value={assignedSearch}
                                    onChange={(e) => setAssignedSearch(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-primary/10 sticky top-0 z-10 transition-none">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-semibold text-primary">Personel Bilgisi</TableHead>
                                            <TableHead className="text-right font-semibold text-primary">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignedPersonnel.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="h-40 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center opacity-50">
                                                        <Users className="w-8 h-8 mb-2" />
                                                        <p>Bu şantiyede atanmış personel yok.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            assignedPersonnel.map(person => {
                                                const isPrimary = person.siteId === selectedSiteId;
                                                return (
                                                    <TableRow key={person.id} className="hover:bg-slate-50">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-800">{person.fullName}</span>
                                                                <span className="text-xs text-muted-foreground">{person.role || person.profession || 'Belirtilmemiş'} • TC Sonu: {person.tcNumber?.slice(-4) || 'Yok'}</span>
                                                                {!isPrimary && person.siteId && (
                                                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600 bg-orange-50 w-fit px-1.5 py-0.5 rounded border border-orange-200">
                                                                        <MapPin className="w-3 h-3" />
                                                                        Asıl Şantiye: {getSiteName(person.siteId)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleRemove([person.id])}
                                                                disabled={loadingIds[person.id]}
                                                                className="w-16"
                                                            >
                                                                {loadingIds[person.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Çıkar"}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* RIGHT: Available Personnel */}
                    <Card className="flex flex-col h-full border-dashed border-2">
                        <CardHeader className="pb-3 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-600" />
                                    Boştaki / Diğer Personel
                                    <Badge variant="secondary" className="ml-2">{availablePersonnel.length}</Badge>
                                </CardTitle>
                            </div>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Personel ara (İsim, TC, Görev)..."
                                    className="pl-9"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 transition-none">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Personel Bilgisi</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {availablePersonnel.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="h-40 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center opacity-50">
                                                        <Filter className="w-8 h-8 mb-2" />
                                                        <p>Eşleşen personel bulunamadı.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            availablePersonnel.map(person => {
                                                const currentSiteName = getSiteName(person.siteId);
                                                return (
                                                    <TableRow key={person.id} className="hover:bg-slate-50">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-800">{person.fullName}</span>
                                                                <span className="text-xs text-muted-foreground">{person.role || person.profession || 'Belirtilmemiş'} • TC Sonu: {person.tcNumber?.slice(-4) || '***'}</span>
                                                                {currentSiteName && (
                                                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {currentSiteName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleAssign([person.id])}
                                                                disabled={loadingIds[person.id]}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-20"
                                                            >
                                                                {loadingIds[person.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ata"}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
