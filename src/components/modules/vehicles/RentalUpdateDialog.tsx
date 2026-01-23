import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store/use-store";
import { useState, useEffect } from "react";
import { Vehicle } from "@/lib/types";

interface RentalUpdateDialogProps {
    vehicle: Vehicle;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RentalUpdateDialog({ vehicle, open, onOpenChange }: RentalUpdateDialogProps) {
    const { updateVehicle, sites } = useAppStore();
    const [monthlyFee, setMonthlyFee] = useState<string>('');
    const [assignedSiteId, setAssignedSiteId] = useState<string>('');

    useEffect(() => {
        if (open && vehicle) {
            setMonthlyFee(vehicle.monthlyRentalFee?.toString() || '');
            setAssignedSiteId(vehicle.assignedSiteId || '');
        }
    }, [open, vehicle]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let fee = 0;
        if (monthlyFee.includes(',')) {
            fee = parseFloat(monthlyFee.replace(/\./g, '').replace(',', '.'));
        } else {
            fee = parseFloat(monthlyFee);
        }

        updateVehicle(vehicle.id, {
            monthlyRentalFee: isNaN(fee) ? 0 : fee,
            assignedSiteId: assignedSiteId, // [NEW] Update Assigned Site
            rentalLastUpdate: new Date().toISOString()
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kira Bedeli Güncelle</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Plaka</Label>
                        <div className="font-mono font-bold text-slate-700 bg-slate-100 p-2 rounded">
                            {vehicle.plate}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Aylık Kira Bedeli (TL)</Label>
                        <Label>Aylık Kira Bedeli (TL)</Label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={monthlyFee}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (/^[0-9.,]*$/.test(val)) {
                                    setMonthlyFee(val);
                                }
                            }}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Giderin Yansıtılacağı Şantiye</Label>
                        <Select
                            value={assignedSiteId}
                            onValueChange={setAssignedSiteId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Şantiye Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            İptal
                        </Button>
                        <Button type="submit">
                            Kaydet
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
