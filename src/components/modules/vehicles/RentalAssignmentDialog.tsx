'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { normalizeSearchText } from '@/lib/utils';
import { toast } from 'sonner';

interface RentalAssignmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RentalAssignmentDialog({ open, onOpenChange }: RentalAssignmentDialogProps) {
    const { vehicles, updateVehicle, companies } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [targetCompanyId, setTargetCompanyId] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Filter for OWNED vehicles only
    const ownedVehicles = vehicles.filter((v: any) => v.ownership === 'OWNED');

    const filteredVehicles = ownedVehicles.filter((v: any) => {
        if (!searchTerm) return true;
        const search = normalizeSearchText(searchTerm);
        return (
            normalizeSearchText(v.plate).includes(search) ||
            normalizeSearchText(v.brand).includes(search) ||
            normalizeSearchText(v.model).includes(search)
        );
    });

    const handleToggle = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredVehicles.map((v: any) => v.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSave = () => {
        if (selectedIds.length === 0) return;
        if (!targetCompanyId) { // [NEW] Validation
            toast.error('Lütfen bir kiralama firması seçiniz.');
            return;
        }

        selectedIds.forEach((id: any) => {
            updateVehicle(id, {
                companyId: targetCompanyId, // [NEW] Update owner to the rental company
                ownership: 'RENTAL',
                monthlyRentalFee: 0, // Default to 0, user can update later
                rentalLastUpdate: new Date().toISOString()
            });
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Kiralık Listesine Araç Ekle</DialogTitle>
                    <DialogDescription>
                        Mevcut "Öz Mal" araçlarınızdan kiralık statüsüne geçirmek istediklerinizi seçiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Plaka veya model ara..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* [NEW] Company Selection */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Kiralama Firması Seçiniz</label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={targetCompanyId}
                            onChange={(e) => setTargetCompanyId(e.target.value)}
                        >
                            <option value="">Firma Seçiniz...</option>
                            {companies.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center space-x-2 py-2 border-b">
                    <Checkbox
                        id="select-all"
                        checked={filteredVehicles.length > 0 && selectedIds.length === filteredVehicles.length}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                    <label
                        htmlFor="select-all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Tümünü Seç ({filteredVehicles.length})
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
                    {filteredVehicles.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            {searchTerm ? 'Sonuç bulunamadı.' : 'Eklenebilecek araç bulunamadı.'}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredVehicles.map((vehicle: any) => (
                                <div key={vehicle.id} className="flex items-center space-x-3 p-3 hover:bg-slate-50">
                                    <Checkbox
                                        id={vehicle.id}
                                        checked={selectedIds.includes(vehicle.id)}
                                        onCheckedChange={() => handleToggle(vehicle.id)}
                                    />
                                    <label
                                        htmlFor={vehicle.id}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                    >
                                        <div className="font-bold">{vehicle.plate}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {companies.find((c: any) => c.id === vehicle.companyId)?.name} • {vehicle.brand} {vehicle.model}
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                    <Button onClick={handleSave} disabled={selectedIds.length === 0}>
                        Seçilenleri Ekle ({selectedIds.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
