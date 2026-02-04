
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
    ArrowRight,
    ArrowLeft,
    Search,
    Users,
    MapPin,
    Briefcase,
    Filter
} from 'lucide-react';
import { addPersonnelToSite, removePersonnelFromSite } from '@/actions/personnel';
import { toast } from 'sonner';

export default function PersonnelAssignment() {
    const { personnel, sites, addPersonnelToSite: updateStoreAdd, removePersonnelFromSite: updateStoreRemove } = useAppStore();
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [selectedAvailable, setSelectedAvailable] = useState<string[]>([]);
    const [selectedAssigned, setSelectedAssigned] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter Logic
    const availablePersonnel = useMemo(() => {
        return personnel
            .filter(p => {
                // Not assigned to selected site
                const isAssignedToThis = p.assignedSiteIds?.includes(selectedSiteId) || p.siteId === selectedSiteId;
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
                const isAssigned = p.assignedSiteIds?.includes(selectedSiteId) || p.siteId === selectedSiteId;
                return isAssigned && p.status !== 'LEFT';
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
    }, [personnel, selectedSiteId]);

    // Handlers
    const handleAssign = async () => {
        if (!selectedSiteId || selectedAvailable.length === 0) return;
        setIsSubmitting(true);
        try {
            const result = await addPersonnelToSite(selectedAvailable, selectedSiteId);
            if (result.success) {
                updateStoreAdd(selectedAvailable, selectedSiteId);
                toast.success(`${selectedAvailable.length} personel şantiyeye atandı.`);
                setSelectedAvailable([]);
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Atama sırasında hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async () => {
        if (!selectedSiteId || selectedAssigned.length === 0) return;
        setIsSubmitting(true);
        try {
            const result = await removePersonnelFromSite(selectedAssigned, selectedSiteId);
            if (result.success) {
                updateStoreRemove(selectedAssigned, selectedSiteId);
                toast.success(`${selectedAssigned.length} personel şantiyeden çıkarıldı.`);
                setSelectedAssigned([]);
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Çıkarma sırasında hata oluştu.');
        } finally {
            setIsSubmitting(false);
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
                                    <Button size="sm" onClick={handleAssign} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                        Seçilenleri Ekle ({selectedAvailable.length})
                                        <ArrowRight className="w-4 h-4 ml-2" />
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
                            {/* Header Row */}
                            <div className="flex items-center p-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                                <div className="w-8 flex justify-center">
                                    <Checkbox
                                        checked={availablePersonnel.length > 0 && selectedAvailable.length === availablePersonnel.length}
                                        onCheckedChange={selectAllAvailable}
                                    />
                                </div>
                                <div className="flex-1 px-2">Personel Bilgisi</div>
                                <div className="w-24 text-right px-2">Görev</div>
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto">
                                {availablePersonnel.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-8 text-center">
                                        <Filter className="w-8 h-8 mb-2" />
                                        <p>Eşleşen personel bulunamadı.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y relative">
                                        {availablePersonnel.map(person => {
                                            const isSelected = selectedAvailable.includes(person.id);
                                            // Determine current location badge
                                            const currentSiteName = getSiteName(person.siteId);

                                            // Handle case where assignedSiteIds might be empty but siteId is set
                                            // If siteId is set and matches a site Name, show it.

                                            return (
                                                <div
                                                    key={person.id}
                                                    onClick={() => toggleAvailable(person.id)}
                                                    className={`
                                                        flex items-center p-3 hover:bg-accent/50 cursor-pointer transition-colors text-sm
                                                        ${isSelected ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30' : ''}
                                                    `}
                                                >
                                                    <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleAvailable(person.id)}
                                                        />
                                                    </div>
                                                    <div className="flex-1 px-2 min-w-0">
                                                        <div className="font-medium truncate  flex items-center gap-2">
                                                            {person.fullName}
                                                            {/* Show Location Badge if they are officially somewhere else */}
                                                            {currentSiteName && person.siteId !== selectedSiteId && (
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                                                                    {currentSiteName}
                                                                </Badge>
                                                            )}
                                                            {/* Show Assigned Count Badge if > 0 */}
                                                            {person.assignedSiteIds && person.assignedSiteIds.length > 0 && (
                                                                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                                                    +{person.assignedSiteIds.length} Site
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                                            <span>{person.tcNumber || 'TC Yok'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-24 text-right px-2 text-xs text-muted-foreground truncate">
                                                        {person.role}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* RIGHT: Assigned Personnel */}
                    <Card className="flex flex-col h-full bg-muted/10 border-2 border-primary/20">
                        <CardHeader className="pb-3 bg-primary/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    Şantiyedeki Personeller
                                    <Badge className="ml-2">{assignedPersonnel.length}</Badge>
                                </CardTitle>
                                {selectedAssigned.length > 0 && (
                                    <Button size="sm" variant="destructive" onClick={handleRemove} disabled={isSubmitting}>
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Çıkar ({selectedAssigned.length})
                                    </Button>
                                )}
                            </div>
                            <div className="h-9"></div> {/* Spacer to check match height with search input */}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                            {/* Header Row */}
                            <div className="flex items-center p-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                                <div className="w-8 flex justify-center">
                                    <Checkbox
                                        checked={assignedPersonnel.length > 0 && selectedAssigned.length === assignedPersonnel.length}
                                        onCheckedChange={selectAllAssigned}
                                    />
                                </div>
                                <div className="flex-1 px-2">Personel Bilgisi</div>
                                <div className="w-24 text-right px-2">Durum</div>
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto">
                                {assignedPersonnel.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-8 text-center">
                                        <Briefcase className="w-8 h-8 mb-2" />
                                        <p>Bu şantiyede atanmış personel yok.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {assignedPersonnel.map(person => {
                                            const isSelected = selectedAssigned.includes(person.id);
                                            return (
                                                <div
                                                    key={person.id}
                                                    onClick={() => toggleAssigned(person.id)}
                                                    className={`
                                                        flex items-center p-3 hover:bg-accent/50 cursor-pointer transition-colors text-sm
                                                        ${isSelected ? 'bg-destructive/10' : ''}
                                                    `}
                                                >
                                                    <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleAssigned(person.id)}
                                                        />
                                                    </div>
                                                    <div className="flex-1 px-2 min-w-0">
                                                        <div className="font-medium truncate">{person.fullName}</div>
                                                        <div className="text-xs text-muted-foreground">{person.role}</div>
                                                    </div>
                                                    <div className="w-24 text-right px-2 text-xs">
                                                        <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                                                            Aktif
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
