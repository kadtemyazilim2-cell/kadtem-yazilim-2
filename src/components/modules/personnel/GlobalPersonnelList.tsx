'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Edit, Trash2, Building2 } from 'lucide-react';
import { PersonnelForm } from './PersonnelForm';
import { Badge } from '@/components/ui/badge';

export function GlobalPersonnelList() {
    const { personnel, sites, deletePersonnel, personnelAttendance } = useAppStore();
    const { hasPermission } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);

    // Permission Check
    const canEdit = hasPermission('personnel.list', 'EDIT') || hasPermission('personnel', 'EDIT');
    // Reuse Edit permission for Delete since 'DELETE' level is not defined in types
    const canDelete = canEdit;

    const filteredPersonnel = useMemo(() => {
        return personnel.filter((p: any) =>
        (p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.tcNumber?.includes(searchTerm) ||
            p.profession?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [personnel, searchTerm]);

    const handleDelete = (p: typeof personnel[0]) => {
        if (!canDelete) return;

        // Validation: Exact same logic as PersonnelList
        const globalAttendanceCount = personnelAttendance.filter((a: any) => a.personnelId === p.id).length;
        const hasTransferHistory = p.transferHistory && p.transferHistory.length > 0;

        if (globalAttendanceCount > 0 || hasTransferHistory) {
            alert(
                `Bu personel silinemez!\n\n` +
                `Silme Engeli:\n` +
                (globalAttendanceCount > 0 ? `- ${globalAttendanceCount} adet Puantaj kaydı bulunmaktadır (Tüm Şantiyeler).\n` : '') +
                (hasTransferHistory ? `- Geçmiş şantiye transfer kayıtları bulunmaktadır.\n` : '') +
                `\nVeri bütünlüğünü korumak için işlem görmüş personeller silinemez. Personel formundan "İşten Ayrıldı" işlemini yapabilirsiniz.`
            );
            return;
        }

        if (confirm(`${p.fullName} isimli personeli kalıcı olarak silmek istediğinize emin misiniz?`)) {
            deletePersonnel(p.id);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Personel ara (Ad, TC, Meslek)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                    Toplam: {filteredPersonnel.length} Personel
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ad Soyad</TableHead>
                            <TableHead>TC Kimlik No</TableHead>
                            <TableHead>Meslek / Görev</TableHead>
                            <TableHead>Şantiye</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPersonnel.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPersonnel.map((p: any) => {
                                const site = sites.find((s: any) => s.id === p.siteId);
                                return (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.fullName}</TableCell>
                                        <TableCell>{p.tcNumber}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{p.profession}</span>
                                                <span className="text-xs text-muted-foreground">{p.role}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-sm">{site?.name || 'Atanmamış'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={p.status === 'ACTIVE' ? 'default' : 'destructive'} className={p.status === 'ACTIVE' ? 'bg-green-600' : ''}>
                                                {p.status === 'ACTIVE' ? 'Aktif' : 'Pasif/Ayrıldı'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {(canEdit || canDelete) && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canEdit && (
                                                            <DropdownMenuItem onClick={() => setEditingPersonnelId(p.id)}>
                                                                <Edit className="w-4 h-4 mr-2" />
                                                                Düzenle
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <DropdownMenuItem onClick={() => handleDelete(p)} className="text-red-600 focus:text-red-600">
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Sil
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Modal */}
            <PersonnelForm
                personnelToEdit={personnel.find((p: any) => p.id === editingPersonnelId)}
                open={!!editingPersonnelId}
                onOpenChange={(open) => !open && setEditingPersonnelId(null)}
            />
        </div>
    );
}
