
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
    const [selectedAvailable, setSelectedAvailable] = useState<string[]>([]);
    const [selectedAssigned, setSelectedAssigned] = useState<string[]>([]);
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                return isAssigned && p.status !== 'LEFT';
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
    }, [personnel, selectedSiteId]);

    // Handlers
    const handleAssign = async (ids?: string[]) => {
        const targetIds = ids || selectedAvailable;
        if (!selectedSiteId || targetIds.length === 0) return;

        if (!ids) setIsSubmitting(true);
        else setLoadingIds(prev => ({ ...prev, [ids[0]]: true }));

        try {
            const result = await addPersonnelToSite(targetIds, selectedSiteId);
            if (result.success) {
                updateStoreAdd(targetIds, selectedSiteId);
                toast.success(`${targetIds.length} personel şantiyeye atandı.`);
                if (!ids) setSelectedAvailable([]);
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Atama sırasında hata oluştu.');
        } finally {
            if (!ids) setIsSubmitting(false);
            else setLoadingIds(prev => ({ ...prev, [ids[0]]: false }));
        }
    };

    const handleRemove = async (ids?: string[]) => {
        const targetIds = ids || selectedAssigned;
        if (!selectedSiteId || targetIds.length === 0) return;

        if (ids && !confirm('Personeli şantiyeden çıkarmak istediğinize emin misiniz?')) return;

        if (!ids) setIsSubmitting(true);
        else setLoadingIds(prev => ({ ...prev, [ids[0]]: true }));

        try {
            const result = await removePersonnelFromSite(targetIds, selectedSiteId);
            if (result.success) {
                updateStoreRemove(targetIds, selectedSiteId);
                toast.success(`${targetIds.length} personel şantiyeden çıkarıldı.`);
                if (!ids) setSelectedAssigned([]);
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Çıkarma sırasında hata oluştu.');
        } finally {
            if (!ids) setIsSubmitting(false);
            else setLoadingIds(prev => ({ ...prev, [ids[0]]: false }));
        }
    };

    // Selection Helpers
    const toggleAvailable = (id: string) => {
        setSelectedAvailable(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAssigned = (id: string) => {
        setSelectedAssigned(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectAllAvailable = () => {
        if (selectedAvailable.length === availablePersonnel.length) setSelectedAvailable([]);
        else setSelectedAvailable(availablePersonnel.map(p => p.id));
    };

    const selectAllAssigned = () => {
        if (selectedAssigned.length === assignedPersonnel.length) setSelectedAssigned([]);
        else setSelectedAssigned(assignedPersonnel.map(p => p.id));
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
                    {/* LEFT: Available Personnel */}
                    <Card className="flex flex-col h-full border-dashed border-2">
                        <CardHeader className="pb-3 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-600" />
                                    Boştaki / Diğer Personel
                                    <Badge variant="secondary" className="ml-2">{availablePersonnel.length}</Badge>
                                </CardTitle>
                                {selectedAvailable.length > 0 && (
                                    <Button size="sm" onClick={() => handleAssign()} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                        Ekle ({selectedAvailable.length})
                                        <Plus className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
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
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={availablePersonnel.length > 0 && selectedAvailable.length === availablePersonnel.length}
                                                    onCheckedChange={selectAllAvailable}
                                                />
                                            </TableHead>
                                            <TableHead>Personel Bilgisi</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {availablePersonnel.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-40 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center opacity-50">
                                                        <Filter className="w-8 h-8 mb-2" />
                                                        <p>Eşleşen personel bulunamadı.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            availablePersonnel.map(person => {
                                                const isSelected = selectedAvailable.includes(person.id);
                                                const currentSiteName = getSiteName(person.siteId);
                                                return (
                                                    <TableRow
                                                        key={person.id}
                                                        className={`cursor-pointer ${isSelected ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30' : ''}`}
                                                        onClick={() => toggleAvailable(person.id)}
                                                    >
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleAvailable(person.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">{person.fullName}</span>
                                                                    {currentSiteName && person.siteId !== selectedSiteId && (
                                                                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                                                                            {currentSiteName}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{person.role}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-16 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                onClick={() => handleAssign([person.id])}
                                                                disabled={loadingIds[person.id]}
                                                            >
                                                                {loadingIds[person.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ekle"}
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

                    {/* RIGHT: Assigned Personnel */}
                    <Card className="flex flex-col h-full border-primary/20 bg-primary/5">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    Şantiyedeki Personeller
                                    <Badge className="ml-2 bg-primary/20 text-primary-foreground">{assignedPersonnel.length}</Badge>
                                </CardTitle>
                                {selectedAssigned.length > 0 && (
                                    <Button size="sm" variant="destructive" onClick={() => handleRemove()} disabled={isSubmitting}>
                                        Çıkar ({selectedAssigned.length})
                                        <X className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                            </div>
                            <div className="h-9"></div> {/* Alignment spacer */}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-primary/5 sticky top-0 z-10 transition-none">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={assignedPersonnel.length > 0 && selectedAssigned.length === assignedPersonnel.length}
                                                    onCheckedChange={selectAllAssigned}
                                                />
                                            </TableHead>
                                            <TableHead>Personel Bilgisi</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignedPersonnel.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-40 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center opacity-50">
                                                        <Briefcase className="w-8 h-8 mb-2" />
                                                        <p>Bu şantiyede atanmış personel yok.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            assignedPersonnel.map(person => {
                                                const isSelected = selectedAssigned.includes(person.id);
                                                return (
                                                    <TableRow
                                                        key={person.id}
                                                        className={`cursor-pointer ${isSelected ? 'bg-destructive/10 hover:bg-destructive/20' : ''}`}
                                                        onClick={() => toggleAssigned(person.id)}
                                                    >
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleAssigned(person.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{person.fullName}</span>
                                                                <span className="text-xs text-muted-foreground">{person.role}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-16 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                                                onClick={() => handleRemove([person.id])}
                                                                disabled={loadingIds[person.id]}
                                                            >
                                                                {loadingIds[person.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Çıkar"}
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
